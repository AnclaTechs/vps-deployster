const os = require("os");
const fs = require("fs");
const net = require("net");
const moment = require("moment");
const redis = require("redis");
const path = require("path");
const dotenv = require("dotenv");
const pool = require("../database/index");
const { exec, execSync, spawn } = require("child_process");
const { DEPLOYMENT_STATUS } = require("./constants");
const { getSingleRow } = require("../database/functions");
const redisClient = require("../redis");

const isIPAddress = (str) => /\d+\.\d+\.\d+\.\d+/.test(str);

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
      if (config.PORT) {
        return config.PORT;
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
 * This is different from the getProjectPort above.
 * Gets the PORT of a running Supervisor program by reading its /proc/<pid>/environ
 * Only works if the Supervisor-managed process is currently running.
 *
 * @param {string} programName - The Supervisor program name
 * @returns {Promise<string|null>} - Port number as string, or null if not found or not running
 */
async function getPipelinePort(projectPath, programName) {
  try {
    const requiredDeploysterConfigurationFile = `dply.${getProjectFolderNameFromPath(
      projectPath
    ).toLowerCase()}.conf`;
    const confPath = path.join(
      projectPath,
      requiredDeploysterConfigurationFile
    );

    if (!fs.existsSync(confPath)) {
      console.error(
        `${requiredDeploysterConfigurationFile} not found in ${projectPath}`
      );
      return null;
    }

    const confContent = fs.readFileSync(confPath, "utf8");
    const confContentObject = parseSupervisorConfPrograms(confContent);
    if (confContentObject[programName]) {
      try {
        const programBlock = confContentObject[programName];
        const port = _extractPortFromSupervisorConf(programBlock);
        return port;
      } catch (err) {
        throw err;
      }
    } else {
      console.error(
        `${programName} not found in ${requiredDeploysterConfigurationFile}`
      );
      return null;
    }
  } catch (err) {
    console.error(`getPipelinePort error: ${err.message}`);
    return null;
  }
}

/**
 * Extracts the PORT value from a program block.
 * @param {string} programBlock
 * @returns {string|null}
 */
function _extractPortFromSupervisorConf(programBlock) {
  // 1. Check environment line for DPLY_PIPELINE_PORT
  const envMatch = programBlock.match(
    /environment=.*?\bDPLY_PIPELINE_PORT\s*=\s*"?(\d+)"?/i
  );
  if (envMatch) return envMatch[1];

  // 2. Check command line for DPLY_PIPELINE_PORT assignment (e.g., in bash or yarn start)
  const cmdMatch = programBlock.match(
    /command=.*?\bDPLY_PIPELINE_PORT\s*=\s*(\d+)/i
  );
  if (cmdMatch) return cmdMatch[1];

  return null;
}

/**
 * Check if a TCP port is currently active (listening).
 * @param {number|string} port - The port number to check.
 * @returns {Promise<boolean>} - Resolves true if port is in use, else false.
 */
async function isPortActive(port) {
  return new Promise((resolve) => {
    /** N.B: It's very probable that service can be running under a user with limited
     * permissions to view the network connections or programs started by other users
     * Thus i priortized ss -tuln (tcp, udp, listen socket) over lsof. ss tends to require less elevated priviledges
     * to see system network statistics. Humorously :) ss is a successor to netstat (I think :| don't quote me)
     */
    exec(`ss -tuln | grep :${port}`, (ssError, ssStdout) => {
      if (ssStdout && !ssError) {
        return resolve(true);
      }

      // Fallback to lsof if ss didn't return results
      exec(`lsof -iTCP:${port} -sTCP:LISTEN -n -P`, (lsofError, lsofStdout) => {
        if (lsofStdout && !lsofError) {
          return resolve(true);
        }
        return resolve(false);
      });
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

function capitalizeFirstLetter(string) {
  return String(string).charAt(0).toUpperCase() + String(string).slice(1);
}

/**
 *
 * @param {String} path
 * @returns {String}
 */
function getProjectFolderNameFromPath(path) {
  return Array.from(path.split("/")).pop();
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
 * Extracts the program names from a supervisor configuration content.
 * @param {string} confContent - The content of the supervisor configuration file.
 * @returns {Array} The extracted program names, or empty array if no program section is found.
 */
function getAllProgramNamesFromConf(confContent) {
  const matches = [...confContent.matchAll(/\[program:([^\]]+)\]/g)];
  return matches.map((match) => match[1].trim());
}

/**
 * Checks the validity of a deployster.conf file in the current working directory.
 * Validates if the file exists and if the program name in the configuration
 * matches the current folder name.
 * @param {String} projectPath
 * @returns {Object} An object containing:
 *  - status {boolean}: True if the configuration is valid, false otherwise.
 *  - message {string}: A message describing the result of the validation.
 */
function checkDeploysterConf(projectPath, pipelineJSON) {
  //const cwd = process.cwd();
  const requiredDeploysterConfigurationFile = `dply.${getProjectFolderNameFromPath(
    projectPath
  ).toLowerCase()}.conf`;
  const confPath = path.join(projectPath, requiredDeploysterConfigurationFile);

  if (!fs.existsSync(confPath)) {
    return {
      status: false,
      message: `${requiredDeploysterConfigurationFile} not found in ${projectPath}`,
    };
  }

  const confContent = fs.readFileSync(confPath, "utf8");

  if (!pipelineJSON) {
    const programName = _getProgramNameFromConf(confContent);

    if (!programName) {
      return {
        status: false,
        message: `Could not find a [program:<name>] section in deployster.conf`,
        data: {},
      };
    }

    const folderName = path.basename(projectPath);

    if (programName === folderName) {
      return {
        status: true,
        message: `Config is valid: [program:${programName}] matches folder name "${folderName}".`,
        data: { programName },
      };
    } else {
      return {
        status: false,
        message: `Mismatch: [program:${programName}] ≠ folder name "${folderName}".`,
        data: { programName },
      };
    }
  } else {
    const allPrograms = getAllProgramNamesFromConf(confContent);
    const stages = pipelineJSON.map((data) => data.git_branch);
    const programName = path.basename(projectPath);
    const expectedPrograms = stages.map((stage) => `${programName}--${stage}`);

    const missingPrograms = expectedPrograms.filter(
      (prog) => !allPrograms.includes(prog)
    );

    if (missingPrograms.length > 0) {
      return {
        status: false,
        message: `Missing programs in conf: ${missingPrograms}`,
        data: { programName },
      };
    } else {
      return {
        status: true,
        message: `All pipeline stages are configured".`,
        data: { programName },
      };
    }
  }
}

/**
 * Parses a Supervisor .conf file and extracts each [program:...] section with its content.
 * @param {string} confContent - The entire .conf file as a string.
 * @returns {Object} An object where keys are program names and values are their config block as strings.
 */
function parseSupervisorConfPrograms(confContent) {
  const lines = confContent.split(/\r?\n/);
  const programs = {};
  let currentProgram = null;
  let currentLines = [];

  for (const line of lines) {
    const programMatch = line.match(/^\[program:([^\]]+)\]/);

    if (programMatch) {
      if (currentProgram) {
        programs[currentProgram] = currentLines.join("\n").trim();
      }

      currentProgram = programMatch[1].trim();
      currentLines = [line];
    } else if (currentProgram) {
      currentLines.push(line);
    }
  }

  if (currentProgram) {
    programs[currentProgram] = currentLines.join("\n").trim();
  }

  return programs;
}

/**
 * Handles server actions (redeploy, kill, status) for a project or pipeline stage.
 * @param {string} projectId - The ID of the project.
 * @param {string} actionType - The action to perform: 'redeploy', 'kill', or 'status'.
 * @param {string} [pipelineStageUUID] - Optional UUID of the pipeline stage.
 * @returns {Promise<Object>} - Result object with status and message.
 */
async function serverActionHandler(projectId, actionType, pipelineStageUUID) {
  try {
    // Fetch project details
    const project = await getSingleRow("SELECT * FROM projects WHERE id = ?", [
      projectId,
    ]);
    if (!project) {
      return { status: false, message: "Project not found" };
    }

    // Get program name based on project path and optional pipeline stage
    function getProgramName() {
      const baseName = getProjectFolderNameFromPath(project.app_local_path);
      if (!pipelineStageUUID) return baseName;

      const pipelineJSON = getProjectPipelineJSON(project.pipeline_json);
      const stage = pipelineJSON.find(
        (stage) => stage.stage_uuid === pipelineStageUUID
      );
      return stage ? `${baseName}--${stage.git_branch}` : baseName;
    }

    // Execute supervisor command
    async function executeCommand(programName, command) {
      try {
        const output = await runShell(command);
        return {
          status: true,
          message:
            output || `${actionType} executed successfully on ${programName}`,
        };
      } catch (error) {
        return {
          status: false,
          message: `Failed to run "${command}": ${error}`,
        };
      }
    }

    const programName = getProgramName();
    const pipelineJSON = getProjectPipelineJSON(project.pipeline_json);
    const supervisorConfig = checkDeploysterConf(
      project.app_local_path,
      pipelineJSON
    );

    if (!supervisorConfig.status) {
      return supervisorConfig;
    }

    // Validate pipeline stage if provided
    let pipelineStage;
    if (pipelineStageUUID) {
      pipelineStage = pipelineJSON.find(
        (stage) => stage.stage_uuid === pipelineStageUUID
      );
      if (!pipelineStage) {
        return { status: false, message: "Pipeline stage not found" };
      }
    }

    // Determine command based on action type
    let command;
    switch (actionType) {
      case "redeploy":
        command = `supervisorctl stop ${programName} && supervisorctl reread && supervisorctl update && supervisorctl start ${programName}`;
        break;
      case "kill":
        command = `supervisorctl stop ${programName}`;
        break;
      case "status":
        command = `supervisorctl status ${programName}`;
        break;
      default:
        return {
          status: false,
          message: 'Invalid action type. Use "redeploy", "kill", or "status".',
        };
    }

    // IF REDEPLOY INJECT .env AGAIN
    if (pipelineStage && Array.isArray(pipelineStage.environment_variables)) {
      const keyValues = pipelineStage.environment_variables.map((env) => {
        // SUPPORT lower and upper case
        const key = env.key ?? env.KEY;
        const value = env.value ?? env.VALUE;
        return `${key}=${value}`;
      });

      const envString = keyValues.join("\n");
      const escapedEnvString = envString.replace(/"/g, '\\"');
      const envCommand = `echo "${escapedEnvString}" > .env`;

      try {
        await runShell(`cd ${project.app_local_path} && ${envCommand}`);
      } catch (error) {
        return {
          status: false,
          message: `Failed to run : ${error}`,
        };
      }
    }

    return await executeCommand(programName, command);
  } catch (error) {
    console.error(`Error in server action (${actionType}):`, error);
    return { status: false, message: "Internal server error" };
  }
}

async function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(stderr || err.message);
        error.code = err.code;
        error.cmd = cmd;
        return reject(error);
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Parses and validates a JSON string representing a project pipeline configuration.
 * @param {string} jsonstring - A JSON string containing pipeline data.
 * @returns {object|null} - The parsed and validated pipeline object, or null if parsing/validation fails.
 */
function getProjectPipelineJSON(jsonstring) {
  if (typeof jsonstring !== "string" || jsonstring.trim() === "") {
    return null;
  }

  try {
    const parsedData = JSON.parse(jsonstring);
    return parsedData;
  } catch (err) {
    return null;
  }
}

async function updatePipelineGitHead(projectId, gitBranch, commitHash) {
  try {
    const projectInView = await getSingleRow(
      `
        SELECT *
        FROM projects
        WHERE id = ?
      `,
      [projectId]
    );

    const pipelineJSON = getProjectPipelineJSON(projectInView.pipeline_json);

    const pipelineStageInView = pipelineJSON.filter(
      (pipeline) => pipeline.git_branch == gitBranch
    )[0];

    if (pipelineJSON) {
      const updatedPipelineJSONrecord = pipelineJSON.map((pipeline) => {
        if (pipeline.git_branch == gitBranch) {
          return {
            ...pipeline,
            current_head: commitHash,
          };
        } else {
          return pipeline;
        }
      });

      // UPDATE PROJECT DETAILS
      await pool.run(
        `
      UPDATE projects 
      SET 
        pipeline_json = ? 
      WHERE id = ?
      `,
        [JSON.stringify(updatedPipelineJSONrecord), projectInView.id]
      );

      return "[INFO] Pipeline Head commit hash updated successfully";
    } else {
      return "[WARN] Unable to get project Pipeline JOSN";
    }
  } catch (err) {
    console.log("Error updating pipeline head", err);
    return `[DEBUG] Error updating pipeline head: ${err}`;
  }
}

async function startRedisServer(port = 6379) {
  return new Promise((resolve) => {
    const localLogPath = path.join(
      __dirname,
      `../logs/deployster-redis${port}.log`
    );

    // const command = `redis-server --port ${port} --daemonize yes --logfile ${localLogPath}`
    const command = [
      "--port",
      port,
      "--bind",
      "0.0.0.0",
      "--daemonize",
      "yes",
      "--logfile",
      `${localLogPath}`,
    ];

    /**
     * @olamigokayphils -  Why did i take the approach above, my assumption is that deployster might be started by a non sudoer, thus
     * reading the default log file might require sudo access, thus i thought it best to parse to a local folder within deployster
     * for easir read.
     */

    const redisProcess = spawn("redis-server", command);

    redisProcess.on("error", () => resolve(false));

    redisProcess.on("close", () => {
      // After daemonizing, verify connection
      const client = net.createConnection({ port }, () => {
        client.write("*1\r\n$4\r\nPING\r\n");
      });

      client.on("data", (data) => {
        if (data.toString().includes("PONG")) {
          resolve(true); // Redis started successfully
        } else {
          resolve(false);
        }
        client.end();
      });

      client.on("error", (err) => {
        resolve(false);
      });
    });
  });
}

async function killRedisServer(port) {
  try {
    const result = await runShell(`pkill -f "redis-server.*${port}" || true`);

    // Verify it's really dead
    await new Promise((r) => setTimeout(r, 300));
    try {
      await runShell(`pgrep -f "redis-server.*${port}"`);
      return false; // Still running
    } catch (err) {
      if (err.code === 1) return true; // Successfully killed
      throw err;
    }
  } catch (err) {
    if (err.code === null && err.cmd.includes("pkill")) {
      // pkill succeeded but returned signal code -- which is normal
      return true;
    }
    throw err;
  }
}

async function getRedisPassword(host = "127.0.0.1", port = 6379) {
  const client = redis.createClient({ socket: { host, port } });

  await client.connect();

  try {
    const res = await client.configGet("requirepass");
    console.log({ res });
  } catch (err) {
    console.error("Error checking password:", err);
  } finally {
    await client.quit();
  }
}

module.exports = {
  isIPAddress,
  getProjectPort,
  getPipelinePort,
  isPortActive,
  addLogToDeploymentRecord,
  markDeploymentAsComplete,
  capitalizeFirstLetter,
  convertFolderNameToDocumentTitle,
  getProjectFolderNameFromPath,
  getLastNLinesFromFile,
  getLogContentFromFile,
  getTotalLinesFromFile,
  expandTilde,
  checkDeploysterConf,
  parseSupervisorConfPrograms,
  runShell,
  serverActionHandler,
  getProjectPipelineJSON,
  updatePipelineGitHead,
  startRedisServer,
  killRedisServer,
  getRedisPassword,
};
