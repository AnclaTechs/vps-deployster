require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  getSystemMonitorLog,
  replaceEmailTemplatePlaceholders,
  getTopProcesses,
} = require("../utils/functools");
const { ioRedisClient } = require("../redis");
const transporter = require("../mailer/nodemailer");
const { hasEmailConfig } = require("../utils/constants");
const { getAllRows } = require("@anclatechs/sql-buns");

async function detectResourceSpikeAndUsageAnomaly() {
  try {
    /**
     * This function strives to track the resource demand of services on the server
     * over a period of time (def. 14 days). Using the 68-95-99 theory that states:
     * that for a normal distribution (server usage/compute is typically symmetrical)
     * data points should cluster around the mean and that:
     * - 68% of the data falls within one standard deviation (S.D) of the mean.
     * - 95% within 2 S.D
     * - 99.7% within 3 S.D
     * Thus Threshold = mean + (2 * std); Obviously "2 S.D is choiced" ;)
     **/

    const CPU_MULTIPLIER = 2;
    const RAM_MULTIPLIER = 2;
    const COOLDOWN_MINUTES = 10;

    const REQUIRED_CONSECUTIVE = 3;
    const WINDOW_SIZE = 5; // For rolling smoothing
    const MIN_DURATION = 60 * 1000; // 1m = 60s sustained spike

    const CPU_KEY = "spike:cpu:count";
    const RAM_KEY = "spike:ram:count";
    const LAST_ALERT_KEY = "monitor:lastAlertTime";
    const SPIKE_START_TIME = "monitor:spikeStartTime";

    // Noise filtering buffers
    let cpuBuffer = [];
    let ramBuffer = [];

    const csvPath = path.resolve(__dirname, "../logs/ram-history.csv");

    const ranges = {
      short: "30m",
      medium: "24h",
      long: "14d",
    };

    // Load logs
    const tsShort = await getSystemMonitorLog(csvPath, ranges.short);
    const tsMedium = await getSystemMonitorLog(csvPath, ranges.medium);
    const tsLong = await getSystemMonitorLog(csvPath, ranges.long);

    // Extract values
    function extractValues(series) {
      return {
        cpu: series.map((x) => parseFloat(Number(x[1]).toFixed(2))),
        ram: series.map((x) => {
          const used = Number(x[2]);
          const total = Number(x[3]);
          const percentUsed = (used / total) * 100;
          return parseFloat(percentUsed.toFixed(2));
        }),
      };
    }

    // Avergage Func
    function average(arr) {
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // S.D
    function standardDeviation(arr, mean) {
      const squareDiffs = arr.map((value) => (value - mean) ** 2);
      const avgSquareDiff = average(squareDiffs);
      return Math.sqrt(avgSquareDiff);
    }

    const shortData = extractValues(tsShort);
    const mediumData = extractValues(tsMedium);
    const longData = extractValues(tsLong);

    // Threshold computation
    function computeThreshold(values) {
      const avg = average(values);
      const std = standardDeviation(values, avg);
      return avg + CPU_MULTIPLIER * std;
    }

    const FALLBACK_THRESHOLD = 70;

    function safe(val, fallback = FALLBACK_THRESHOLD) {
      return Number.isFinite(val) ? val : fallback;
    }

    const raw = {
      shortCpu: safe(computeThreshold(shortData.cpu)),
      mediumCpu: safe(computeThreshold(mediumData.cpu)),
      longCpu: safe(computeThreshold(longData.cpu)),

      shortRam: safe(computeThreshold(shortData.ram)),
      mediumRam: safe(computeThreshold(mediumData.ram)),
      longRam: safe(computeThreshold(longData.ram)),
    };

    const thresholds = {
      /** The idea behind this is that:
       *
       * My Long-range data (14 days) is stable, this is predictive and less sensitive to noise.
       * Medium (24 hours) is moderately stable.
       * Short (30 minutes) is the most sensitive and the easiest to distort.
       * Thus this simple algorithm shortThreshold ≤ mediumThreshold ≤ longThreshold
       */
      shortCpu: Math.min(raw.shortCpu, raw.mediumCpu),
      shortRam: Math.min(raw.shortRam, raw.mediumRam),

      mediumCpu: Math.max(
        Math.min(raw.shortCpu, raw.mediumCpu),
        Math.min(raw.mediumCpu, raw.longCpu)
      ),
      mediumRam: Math.max(
        Math.min(raw.shortRam, raw.mediumRam),
        Math.min(raw.mediumRam, raw.longRam)
      ),

      longCpu: Math.max(raw.mediumCpu, raw.longCpu),
      longRam: Math.max(raw.mediumRam, raw.longRam),
    };

    // Latest raw reading
    const latestCpu = shortData.cpu.at(-1);
    cpuBuffer =
      shortData.cpu.length >= 6 ? shortData.cpu.slice(-6) : [...shortData.cpu];

    const latestRam = shortData.ram.at(-1);
    ramBuffer =
      shortData.ram.length >= 6 ? shortData.ram.slice(-6) : [...shortData.ram];

    function smoothPush(value, buffer) {
      /**
       * A Smooth Push rolling over last n readings drives better accuracy instead of just picking the latest one.
       * This helps smoothen out random spikes that are not meaningful. For instance:
       * CPU % readings: [30, 35, 32, 80, 34] 80 is high but avg = 42
       */
      buffer.push(value);
      if (buffer.length > WINDOW_SIZE) buffer.shift();
      return average(buffer);
    }

    const smoothedCpu = smoothPush(latestCpu, cpuBuffer);
    const smoothedRam = smoothPush(latestRam, ramBuffer);

    // Spike detection across ranges
    function detectSpike(cpu, ram, thresholds) {
      return {
        short: cpu > thresholds.shortCpu || ram > thresholds.shortRam,
        medium: cpu > thresholds.mediumCpu || ram > thresholds.mediumRam,
        long: cpu > thresholds.longCpu || ram > thresholds.longRam,
      };
    }

    const spike = detectSpike(smoothedCpu, smoothedRam, thresholds);

    async function checkConsecutive(spike) {
      /**
       * This helps ensure a one time spike doesn't trigger an emergency response.
       */

      let cpuCount, ramCount;

      if (spike.short || spike.medium || spike.long) {
        cpuCount = await ioRedisClient.incr(CPU_KEY);
        ramCount = await ioRedisClient.incr(RAM_KEY);
      } else {
        // Reset to zero when no spike
        await ioRedisClient.set(CPU_KEY, 0);
        await ioRedisClient.set(RAM_KEY, 0);
        cpuCount = 0;
        ramCount = 0;
      }

      return (
        cpuCount >= REQUIRED_CONSECUTIVE || ramCount >= REQUIRED_CONSECUTIVE
      );
    }

    // Duration filter
    async function durationExceeded(spike) {
      const now = Date.now();
      let startTime = await ioRedisClient.get(SPIKE_START_TIME);

      startTime = startTime ? Number(startTime) : null;

      const isSpike = spike.short || spike.medium || spike.long;

      if (isSpike) {
        if (!startTime) {
          await ioRedisClient.set(SPIKE_START_TIME, now);
          startTime = now;
        }

        if (now - startTime >= MIN_DURATION) {
          return true;
        }
      } else {
        await ioRedisClient.del(SPIKE_START_TIME);
      }

      return false;
    }

    // Final decision
    const now = Date.now();
    const ts = await ioRedisClient.get(LAST_ALERT_KEY);
    const lastAlertTime = ts ? Number(ts) : new Date("1990").getTime();

    const cooldownExpired = now - lastAlertTime > COOLDOWN_MINUTES * 60 * 1000;

    const isConsecutive = await checkConsecutive(spike);
    const isDuration = await durationExceeded(spike);

    const finalSpike =
      cooldownExpired && spike.short && (isConsecutive || isDuration);

    if (finalSpike) {
      let topProcessesTemplate = "";
      const topProcesses = await getTopProcesses();

      for (const process of topProcesses.slice(0, 10)) {
        topProcessesTemplate += `<tr>
          <td style="border-bottom: 1px solid #eeeeee; color: #333">
            <strong>${process.process}</strong>
          </td>
          <td
            align="right"
            style="border-bottom: 1px solid #eeeeee; color: #d9534f"
          >
            <strong>${process.memory_percentage}%</strong>
          </td>
          <td
            align="right"
            style="border-bottom: 1px solid #eeeeee; color: #333"
          >
            ${process.size}
          </td>
        </tr>

        `;
      }

      const spikeLevel = spike.long
        ? "Long-term"
        : spike.medium
        ? "Medium-term"
        : spike.short
        ? "Short-term"
        : "No spike";

      if (hasEmailConfig) {
        const recipients = await getAllRows("SELECT email FROM users");

        // Replace placeholders
        const emailHtmlTemplatePath = path.join(
          __dirname,
          "..",
          "template",
          "email",
          "alert.html"
        );

        const emailTextTemplatePath = path.join(
          __dirname,
          "..",
          "template",
          "email",
          "alert.html"
        );

        const data = {
          deploysterPublicIp: process.env.DEPLOYSTER_VPS_PUBLIC_IP,
          cpuLoad: Number(smoothedCpu).toFixed(2),
          ramUsage: Number(smoothedRam).toFixed(2),
          topProcesses: topProcessesTemplate,
          url: `${process.env.DEPLOYSTER_PROTOCOL}://${process.env.DEPLOYSTER_VPS_PUBLIC_IP}/${process.env.DEPLOYSTER_ADMIN_PATH}`,
          cpuExpected: spike.long
            ? Number(thresholds.longCpu).toFixed(2)
            : spike.medium
            ? Number(thresholds.mediumCpu).toFixed(2)
            : spike.short
            ? Number(thresholds.shortCpu).toFixed(2)
            : "N/A",
          ramExpected: spike.long
            ? Number(thresholds.longRam).toFixed(2)
            : spike.medium
            ? Number(thresholds.mediumRam).toFixed(2)
            : spike.short
            ? Number(thresholds.shortRam).toFixed(2)
            : "N/A",
          timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        };

        const emailHtmlTemplate = fs.readFileSync(
          emailHtmlTemplatePath,
          "utf-8"
        );
        const emailTextTemplate = fs.readFileSync(
          emailTextTemplatePath,
          "utf-8"
        );
        const emailHtmlContent = replaceEmailTemplatePlaceholders(
          emailHtmlTemplate,
          data
        );
        const emailTextContent = replaceEmailTemplatePlaceholders(
          emailTextTemplate,
          data
        );

        // Send Email
        await (async () => {
          const info = await transporter.sendMail({
            from: `"${
              process.env.DEPLOYSTER_SMTP_FROM_NAME ?? "Deployster Monitoring"
            }" <${
              process.env.DEPLOYSTER_SMTP_FROM_EMAIL ||
              process.env.DEPLOYSTER_SMTP_USER
            }>`,
            to: recipients.map((user) => user.email).join(","),
            subject: `🚨 High Resource Alert - CPU (${smoothedCpu}%) RAM(${smoothedRam})`,
            html: emailHtmlContent,
            text: emailTextContent,
          });
        })();
      }

      await ioRedisClient.set(LAST_ALERT_KEY, now);
    } else {
      console.log("No spike detected.");
    }
  } catch (error) {
    console.log(error);
    console.log("Error running resource usage anomaly tracker function");
  }

  process.exit(0);
}

detectResourceSpikeAndUsageAnomaly();
