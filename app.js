require("dotenv").config();
const http = require("http");
const moment = require("moment");
const path = require("path");
const expressLayout = require("express-ejs-layouts");
const express = require("express");
const cors = require("cors");
const redisClient = require("./redis");
const app = express();
const DEPLOYSTER_PORT = process.env.DEPLOYSTER_PORT || 3259;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "*";
const viewRoutes = require("./routes");
const apiRoutes = require("./routes/api");
const pool = require("./database");
const { getSingleRow, createRowAndReturn } = require("./database/functions");
const { RecordDoesNotExist } = require("./database/error");
const {
  addLogToDeploymentRecord,
  markDeploymentAsComplete,
  getProjectPort,
  runShell,
  updatePipelineGitHead,
  getProjectPipelineJSON,
} = require("./utils/functools");
const { DEPLOYMENT_STATUS } = require("./utils/constants");
const setupTerminalWSS = require("./webscokets");

// view engine setup
app.set("views", path.join(__dirname, "template/ejs-views"));
app.use(expressLayout);
app.set("view engine", "ejs");
app.use("/public", express.static(path.join(__dirname, "public")));

app.use(cors());
// BODY PARSER => application/json
app.use(express.json());
// BODY PARSER => application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGINS);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.use("", viewRoutes);
app.use("/api", apiRoutes);

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
  let ACTIVE_PROJECT_DEPLOYSTER_PORT;
  let deploymentRecord;
  let user;
  let projectInView;
  let deploymentLockKey;
  let pipelineJSON;
  const deploymentTimestamp = moment().format("YYYY-MM-DD HH:mm:ss");
  const job_id = Date.now().toString();
  const { cd, commands, commit_hash, ref_name } = req.body;

  if (!commit_hash) {
    // FOR version 1.0 BACKWARD COMPACTIBILITY
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
    return;
  }

  // LOCAL GIT HOUSE KEEPING
  const gitCommands = [
    `git stash`,
    `git stash drop`,
    `git fetch`,
    `git checkout ${ref_name}`,
  ];

  try {
    /** GET PROJECT CURRENT DEPLOYSTER_PORT */
    ACTIVE_PROJECT_DEPLOYSTER_PORT = await getProjectPort(cd);
    if (ACTIVE_PROJECT_DEPLOYSTER_PORT) {
      console.log(`Detected port: ${ACTIVE_PROJECT_DEPLOYSTER_PORT}`);
    } else {
      console.log("Port not found.");
    }
  } catch (error) {
    console.error("Error determining DEPLOYSTER_PORT no:", error);
  }

  try {
    /**
     * Default to first user in DB
     * @TODO - Create a Group system that manages this better
     *  */
    user = await getSingleRow("SELECT * FROM users ORDER BY id DESC LIMIT 1");

    try {
      projectInView = await getSingleRow(
        "SELECT * FROM projects WHERE app_local_path = ?",
        [cd]
      );
      try {
        deploymentLockKey = `lock:deploy:${projectInView.id}`;
        const acquired = await redisClient.set(
          deploymentLockKey,
          "locked",
          "NX",
          "EX",
          600 // 10 mins
        );

        if (!acquired) {
          return res.status(409).json({
            error: "Project has another deployment activity in progress.",
          });
        }
      } catch (error) {
        throw Error("Error getting deployment lock key");
      }
      await pool.run(
        "UPDATE projects SET current_head = ?, tcp_port = ? WHERE id = ?",
        [commit_hash, ACTIVE_PROJECT_DEPLOYSTER_PORT, projectInView.id]
      );
    } catch (error) {
      if (error instanceof RecordDoesNotExist) {
        projectInView = await createRowAndReturn(
          "projects",
          "INSERT INTO projects (user_id, current_head, app_local_path, tcp_port) VALUES (?, ?, ?, ?)",
          [user.id, commit_hash, cd, ACTIVE_PROJECT_DEPLOYSTER_PORT]
        );

        // GET PIPELINE JSON
        pipelineJSON = getProjectPipelineJSON(projectInView.pipeline_json);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("Error processing project metadata:", error);
  }

  try {
    // CREATE DEPLOYMENT RECORD LOG
    deploymentRecord = await createRowAndReturn(
      "deployments",
      "INSERT INTO deployments (user_id, project_id, commit_hash, pipeline_stage_uuid, action, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        user.id,
        projectInView.id,
        commit_hash,
        pipelineJSON
          ? pipelineJSON.filter(
              (pipeline) => pipeline.git_branch == ref_name
            )[0]?.stage_uuid
          : null,
        "DEPLOY",
        "RUNNING",
        deploymentTimestamp,
      ]
    );
  } catch (error) {
    console.error("Error recording deployment log:", error);
  }

  await redisClient.set(`job:${job_id}:status`, "queued");
  await redisClient.del(`job:${job_id}:logs`);

  res.json({ job_id });

  (async () => {
    await redisClient.set(`job:${job_id}:status`, "running");

    // VALIDATE LAST COMMAND
    // Check that the last command includes supervisorctl start or supervisorctl restart:
    const lastCommand = commands[commands.length - 1] || "";
    if (!/supervisorctl\s+(start|restart)\s+[\w\-]+/.test(lastCommand)) {
      const errorOutput =
        "[ERROR] Last command must be a 'supervisorctl start|restart'. Aborting...\n";
      await redisClient.set(`job:${job_id}:status`, "failed");
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      if (deploymentRecord) {
        await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
        await markDeploymentAsComplete(
          deploymentRecord.id,
          DEPLOYMENT_STATUS.FAILED,
          null,
          deploymentLockKey
        );
      }
      return;
    }

    // INJECT ENV ENVIRONMENT
    if (pipelineJSON && Array.isArray(pipelineJSON)) {
      const pipelineStage = pipelineJSON.find((p) => p.git_branch === ref_name);

      if (pipelineStage && Array.isArray(pipelineStage.environment_variables)) {
        const keyValues = pipelineStage.environment_variables.map(
          ({ KEY, VALUE }) => `${KEY}=${VALUE}`
        );

        const envString = keyValues.join("\n");
        const escapedEnvString = envString.replace(/"/g, '\\"');
        const envCommand = `echo "${escapedEnvString}" > .env`;

        // Insert .env creation right before the last command
        commands.splice(commands.length - 1, 0, envCommand);
      }
    }

    // Append additional supervisor commands
    const rereadCommand = `supervisorctl reread`;
    const updateCommand = `supervisorctl update`;

    commands.splice(commands.length - 1, 0, rereadCommand, updateCommand);

    const fullDeploymentCommandList = [...gitCommands, ...commands];

    for (let i = 0; i < fullDeploymentCommandList.length; i++) {
      const command = `cd ${cd} && ${fullDeploymentCommandList[i]}`;
      const formattedCommand = `\n[${i + 1}] $ ${
        fullDeploymentCommandList[i]
      }\n`;
      await redisClient.append(`job:${job_id}:logs`, formattedCommand);

      try {
        const output = await runShell(command);
        await redisClient.append(`job:${job_id}:logs`, output);
        if (deploymentRecord)
          await addLogToDeploymentRecord(deploymentRecord.id, output);
      } catch (err) {
        const errorOutput = `[ERROR] ${err}\n`;
        await redisClient.append(`job:${job_id}:logs`, errorOutput);
        await redisClient.set(`job:${job_id}:status`, "failed");
        if (deploymentRecord) {
          await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
          await markDeploymentAsComplete(
            deploymentRecord.id,
            DEPLOYMENT_STATUS.FAILED,
            null,
            deploymentLockKey
          );
        }
        return;
      }
    }
    await redisClient.set(`job:${job_id}:status`, "complete");
    await markDeploymentAsComplete(
      deploymentRecord.id,
      DEPLOYMENT_STATUS.COMPLETED,
      null,
      null // HOLD ON SUCCESSFUL LOCK-KEY for a moment. It's passed a little later
    );

    if (pipelineJSON) {
      await updatePipelineGitHead(projectInView.id, ref_name, commit_hash);
    }

    // STORE ARTIFACT
    var newLogMessage = "\nCompressing artifact\n";
    await redisClient.set(`job:${job_id}:logs`, newLogMessage);
    await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    const cleanCdPath = cd
      .replace(/^\/*|\/*$/g, "") // Remove leading/trailing slashes
      .replace(/[^\w\-\/]/g, "_") // Replace non-word, non-hyphen, non-slash characters with underscore _
      .replace(/\//g, "_"); // Replace slash with underscore _
    const artifactBase = path.join(__dirname, "deploy-artifacts");
    const artifactDir = path.join(artifactBase, cleanCdPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const shortcommitHash = commit_hash.slice(0, 8);
    const artifactPath = path.join(
      artifactDir,
      `deploy-${timestamp}-${shortcommitHash}.tar.gz`
    );

    try {
      // await fs.mkdir(artifactDir, { recursive: true });
      var newLogMessage = await runShell(`mkdir -p ${artifactDir}`);
      await redisClient.set(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

      // Create archive
      var newLogMessage = await runShell(
        `tar -czf ${artifactPath} -C "${cd}" .`
      );
      await redisClient.set(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

      var newLogMessage = `\n[INFO] Artifact created at ${artifactPath}\n`;
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.COMPLETED,
        artifactPath,
        deploymentLockKey,
        { createActivityLog: false } //skip Log regeneration
      );
    } catch (err) {
      var newLogMessage = `[WARN] Artifact generation failed: ${err.message}\n`;
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    }
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

const server = http.createServer(app);
setupTerminalWSS(server);

server.listen(DEPLOYSTER_PORT, () =>
  console.log(`🚀 Deployster Server running on port ${DEPLOYSTER_PORT}`)
);
