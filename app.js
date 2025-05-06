const PORT = process.env.PORT || 3259;
const express = require("express");
const { exec } = require("child_process");
const app = express();
app.use(express.json());
const redisClient = require("./redis");

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/template/status.html");
});

app.post("/deploy", async (req, res) => {
  const token = req.headers["x-deployster-token"];

  if (!token || token !== process.env.DEPLOYSTER_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  {
    /** PROCEED */
  }

  const job_id = Date.now().toString();
  const { cd, commands } = req.body;

  await redisClient.set(`job:${job_id}:status`, "queued");
  await redisClient.del(`job:${job_id}:logs`);

  res.json({ job_id });

  (async () => {
    await redisClient.set(`job:${job_id}:status`, "running");
    for (let i = 0; i < commands.length; i++) {
      const command = `cd ${cd} && ${commands[i]}`;
      await redisClient.append(
        `job:${job_id}:logs`,
        `\n[${i + 1}] $ ${commands[i]}\n`
      );
      try {
        const output = await runShell(command);
        await redisClient.append(`job:${job_id}:logs`, output);
      } catch (err) {
        await redisClient.append(`job:${job_id}:logs`, `[ERROR] ${err}\n`);
        await redisClient.set(`job:${job_id}:status`, "failed");
        return;
      }
    }
    await redisClient.set(`job:${job_id}:status`, "complete");
  })();
});

app.get("/status/:job_id", async (req, res) => {
  const token = req.headers["x-deployster-token"];

  if (!token || token !== process.env.DEPLOYSTER_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  {
    /** PROCEED */
  }
  const job_id = req.params.job_id;
  const status = await redisClient.get(`job:${job_id}:status`);
  const logs = await redisClient.get(`job:${job_id}:logs`);

  if (!status) return res.status(404).json({ status: "not_found" });

  // Clear the logs from Redis after sending them
  await redisClient.del(`job:${job_id}:logs`);

  res.json({ status, logs: logs || "" });
});

function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

app.listen(PORT, () =>
  console.log(`🚀 Deployster Server running on port ${PORT}`)
);
