const schedule = require("node-schedule");
const { spawn } = require("child_process");

schedule.scheduleJob("*/2 * * * *", () => {
  console.log(`[${new Date().toLocaleString()}] Resource monitor running`);

  const process = spawn("yarn", ["resource-monitor"], { shell: true });

  process.stdout.on("data", (data) => {
    console.log(`STDOUT: ${data.toString()}`);
  });

  process.stderr.on("data", (data) => {
    console.error(`STDERR: ${data.toString()}`);
  });

  process.on("close", (code) => {
    console.log(`Resource monitor completed with exit code ${code}`);
  });
});
