const os = require("os");
const fs = require("fs");
const moment = require("moment");
const path = require("path");
const dotenv = require("dotenv");
const pool = require("../database/index");
const { exec, execSync } = require("child_process");
const { DEPLOYMENT_STATUS } = require("./constants");
const { getSingleRow } = require("../database/functions");
const redisClient = require("../redis");

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

async function markDeploymentAsComplete(
  deploymentId,
  status,
  artifactPath,
  deploymentLockKey,
  options = { createActivityLog: true }
) {
  try {
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

      // CREATE ACTIVITY LOG FOR DEPLOYMENT
      if (options.createActivityLog) {
        await pool.run(
          "INSERT INTO activity_logs (project_id, deployment_id, action, message, created_at) VALUES(?, ?, ?, ?, ?)",
          [
            currentDeploymentRecord.project_id,
            currentDeploymentRecord.id,
            currentDeploymentRecord.action,
            status == DEPLOYMENT_STATUS.COMPLETED
              ? "Build succeeded"
              : "Build failed",
            moment().format("YYYY-MM-DD HH:mm:ss"),
          ]
        );
      }
    } else {
      throw Error("Invalid deployment status");
    }
  } catch (error) {
    console.log("Error marking deployment as complete", error);
  } finally {
    if (deploymentLockKey) {
      await redisClient.del(deploymentLockKey);
    }
  }
}

function convertFolderNameToDocumentTitle(folderName) {
  // Replace non-alphanumeric characters with a space
  const cleaned = folderName.replace(/[^a-zA-Z0-9]+/g, " ");
  // Capitalize each word
  return cleaned
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Wrapper function around native tail terminal method
 * @param {String} path
 * @param {Number} n
 * @returns {Array}
 */
async function getLastNLinesFromFile(path, n = 1000) {
  return new Promise((resolve, reject) => {
    exec(`tail -n ${n} "${path}"`, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.split("\n"));
    });
  });
}

/**
 *
 * @param {String} path
 * @param {Number} fromLine
 * @param {Number} limit
 * @returns {Promise}
 */
function getLogContentFromFile(path, fromLine = 0, limit = 1000) {
  return new Promise((resolve, reject) => {
    const cmd = `tail -n +${fromLine + 1} "${path}" | head -n ${limit}`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.split("\n"));
    });
  });
}

function getTotalLinesFromFile(path) {
  return new Promise((resolve, reject) => {
    exec(`wc -l < "${path}"`, (err, stdout) => {
      if (err) return reject(err);
      resolve(parseInt(stdout.trim(), 10));
    });
  });
}

function expandTilde(filePath) {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Extracts the program name from a supervisor configuration content.
 * @param {string} confContent - The content of the supervisor configuration file.
 * @returns {string|null} The extracted program name, or null if no program section is found.
 */
function _getProgramNameFromConf(confContent) {
  const match = confContent.match(/\[program:([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

/**
 * Checks the validity of a deployster.conf file in the current working directory.
 * Validates if the file exists and if the program name in the configuration
 * matches the current folder name.
 * @param {String} project_path
 * @returns {Object} An object containing:
 *  - status {boolean}: True if the configuration is valid, false otherwise.
 *  - message {string}: A message describing the result of the validation.
 */
function checkDeploysterConf(project_path) {
  //const cwd = process.cwd();
  const confPath = path.join(project_path, "deployster.conf");

  if (!fs.existsSync(confPath)) {
    return {
      status: false,
      message: `deployster.conf not found in ${project_path}`,
    };
  }

  const confContent = fs.readFileSync(confPath, "utf8");
  const programName = _getProgramNameFromConf(confContent);

  if (!programName) {
    return {
      status: false,
      message: `Could not find a [program:<name>] section in deployster.conf`,
    };
  }

  const folderName = path.basename(project_path);

  if (programName === folderName) {
    return {
      status: true,
      message: `Config is valid: [program:${programName}] matches folder name "${folderName}".`,
    };
  } else {
    return {
      status: false,
      message: `Mismatch: [program:${programName}] ≠ folder name "${folderName}".`,
    };
  }
}

async function handleServerSpinOrKillAction(projectPath, actionType) {
  const conf = checkDeploysterConf(projectPath);
  if (!conf.status) {
    return conf;
  }

  let command;
  if (actionType === "redeploy") {
    command = `supervisorctl restart ${programName}`;
  } else if (actionType === "kill") {
    command = `supervisorctl stop ${programName}`;
  } else {
    return {
      status: false,
      message: 'Invalid action type. Use "redeploy" or "kill".',
    };
  }

  try {
    const output = await runShell(command);
    return {
      status: true,
      message: output || `${actionType} executed on ${programName}`,
    };
  } catch (err) {
    return { status: false, message: `Failed to run "${command}": ${err}` };
  }
}

async function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

module.exports = {
  getProjectPort,
  isPortActive,
  addLogToDeploymentRecord,
  markDeploymentAsComplete,
  convertFolderNameToDocumentTitle,
  getLastNLinesFromFile,
  getLogContentFromFile,
  getTotalLinesFromFile,
  expandTilde,
  checkDeploysterConf,
  runShell,
  handleServerSpinOrKillAction,
};
