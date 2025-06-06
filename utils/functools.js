const fs = require("fs");
const moment = require("moment");
const path = require("path");
const dotenv = require("dotenv");
const pool = require("../database/index");
const { exec, execSync } = require("child_process");
const { DEPLOYMENT_STATUS } = require("./constants");
const { getSingleRow } = require("../database/functions");

/**
 * Tries to get the port number from a project's .env file or falls back to detecting it from lsof
 * @param {string} projectPath - Absolute path to the project directory
 * @returns {string|null} - Port number or null if not found
 */
async function getProjectPort(projectPath) {
  try {
    const envPath = path.join(projectPath, ".env");
    if (fs.existsSync(envPath)) {
      const config = dotenv.parse(fs.readFileSync(envPath));
      if (config.DEPLOYSTER_PORT) {
        return config.DEPLOYSTER_PORT;
      }
    }

    const output = execSync("lsof -iTCP -sTCP:LISTEN -n -P", {
      encoding: "utf-8",
    });

    const lines = output.split("\n").slice(1).filter(Boolean);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const [command, pid, , , , , , , name] = parts;

      if (name && name.includes(":")) {
        const port = name.split(":").pop();

        const cmdOutput = execSync(`ps -p ${pid} -o cmd=`, {
          encoding: "utf-8",
        }).trim();

        if (cmdOutput.includes(projectPath)) {
          return port;
        }
      }
    }

    return null;
  } catch (err) {
    console.error("Error detecting port:", err.message);
    return null;
  }
}

/**
 * Check if a TCP port is currently active (listening).
 * @param {number|string} port - The port number to check.
 * @returns {Promise<boolean>} - Resolves true if port is in use, else false.
 */
async function isPortActive(port) {
  return new Promise((resolve) => {
    exec(`lsof -iTCP:${port} -sTCP:LISTEN -n -P`, (error, stdout) => {
      if (error || !stdout) {
        return resolve(false); // Port not in use or error
      }
      return resolve(true); // Port is in use
    });
  });
}

/**
 * Save terminal output to system
 * @param {Number} deploymentId
 * @param {String} logData
 * @returns {Object}
 */

async function addLogToDeploymentRecord(deploymentId, logData) {
  const currentDeploymentRecord = await getSingleRow(
    "SELECT * FROM deployments WHERE id = ?",
    [deploymentId]
  );

  const updatedLog = (currentDeploymentRecord?.log_output || "") + logData;

  await pool.run("UPDATE deployments SET log_output = ? WHERE id = ?", [
    updatedLog,
    deploymentId,
  ]);
}

async function markDeploymentAsComplete(deploymentId, status, artifactPath) {
  const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  const currentDeploymentRecord = await getSingleRow(
    "SELECT * FROM deployments WHERE id = ?",
    [deploymentId]
  );

  if (
    [DEPLOYMENT_STATUS.FAILED, DEPLOYMENT_STATUS.COMPLETED].includes(status)
  ) {
    if (artifactPath) {
      await pool.run(
        "UPDATE deployments SET status = ?, finished_at = ?, artifact_path = ? WHERE id = ?",
        [status, timestamp, artifactPath, currentDeploymentRecord.id]
      );
    } else {
      await pool.run(
        "UPDATE deployments SET status = ?, finished_at = ? WHERE id = ?",
        [status, timestamp, deploymentId]
      );
    }
  } else {
    throw Error("Invalid deployment status");
  }
}

module.exports = {
  getProjectPort,
  isPortActive,
  addLogToDeploymentRecord,
  markDeploymentAsComplete,
};
