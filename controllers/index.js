const fs = require("fs").promises;
const path = require("path");
const net = require("net");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const JWTR = require("jwt-redis").default;
const { parse: csvParse } = require("csv-parse/sync");
const {
  pool,
  getSingleRow,
  RecordDoesNotExist,
} = require("@anclatechs/sql-buns");
const {
  createUserValidationSchema,
  loginValidationSchema,
  updateProjectValidationSchema,
  serverActionValidationSchema,
  bashAccessValidationSchema,
  pipelineJsonValidationSchema,
  updateExistingPipelineJsonValidationSchema,
  deleteExistingPipelineJsonValidationSchema,
  rollbackToCommitValidationSchema,
  createRedisInstanceValidationSchema,
  redisClientAdminOptionValidationSchema,
  databaseCredentialsValidationSchema,
  disconnectIdlePgConnectionValidationSchema,
  databaseQueryValidationSchema,
  mfaSetupValidationSchema,
} = require("../utils/validator");
const { redisClient, ioRedisClient } = require("../redis");
const {
  isPortActive,
  convertFolderNameToDocumentTitle,
  getTotalLinesFromFile,
  getLogContentFromFile,
  expandTilde,
  checkDeploysterConf,
  serverActionHandler,
  getProjectFolderNameFromPath,
  getProjectPipelineJSON,
  capitalizeFirstLetter,
  getPipelinePort,
  addLogToDeploymentRecord,
  markDeploymentAsComplete,
  runShell,
  startRedisServer,
  killRedisServer,
  listPostgresClusters,
  getPostgresCredentials,
  runNativePsqlQuery,
  formatDatabaseLiveDuration,
  convertBytesToHumanReadableFileSize,
  cleanSqlQuery,
  getCpuTopology,
  getTopProcesses,
  computeTopDiskFiles,
  getSystemMonitorLog,
  verifyTwoFactorToken,
} = require("../utils/functools");
const {
  DEPLOYMENT_STATUS,
  PASSWORD_TTL,
  PG_PASSWORD_KEY,
  PG_USERNAME_KEY,
  PG_CLUSTER,
  hasMfaConfig,
  hasEmailConfig,
} = require("../utils/constants");
const signals = require("../signals");
const { Users } = require("../database/models");
const jwtr = new JWTR(redisClient);
const DEPLOYSTER_VPS_PUBLIC_IP =
  process.env.DEPLOYSTER_VPS_PUBLIC_IP || "127.0.0.1";

const TOP_FILES_REDIS_KEY = "sysTopFiles:v1";
const TOP_FILES_TTL = 60 * 60 * 6; // 6 hours

async function createUser(req, res) {
  try {
    const { error } = createUserValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }
    let { token, username, email, password } = req.body;
    if (token != process.env.DEPLOYSTER_TOKEN) {
      return res.status(401).json({
        status: false,
        message: "Invalid deployster token.",
      });
    }
    let user;
    try {
      user = await getSingleRow(
        "SELECT * FROM users WHERE email = ? OR username = ?",
        [email, username]
      );

      if (user) {
        return res.status(403).json({
          status: false,
          message: "Admin with this email or username already exists.",
        });
      }
    } catch (error) {
      if (error instanceof RecordDoesNotExist) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        await pool.run(
          "INSERT INTO users (username, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          [username, email, hashedPassword, `${timestamp}`, `${timestamp}`]
        );

        return res.status(200).json({
          status: true,
          message: "User account created successfully",
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.log({ error });
    return res.status(500).json({
      status: false,
      message: "Error processing request",
    });
  }
}

async function loginUser(req, res) {
  try {
    const { error } = loginValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const { username, password, totp } = req.body;
    let user;
    try {
      if (username.includes("@")) {
        user = await getSingleRow("SELECT * FROM users WHERE email = ?", [
          String(username).toLocaleLowerCase(),
        ]);
      } else {
        user = await getSingleRow("SELECT * FROM users WHERE username = ?", [
          username,
        ]);
      }
    } catch (error) {
      if (error instanceof RecordDoesNotExist) {
        return res
          .status(401)
          .json({ status: false, message: "Invalid email or password" });
      } else {
        console.log({ error });
        return res
          .status(500)
          .json({ status: false, message: `Error logging in ${error}` });
      }
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid email or password" });
    }

    if (user.totp_secret) {
      if (!totp) {
        return res.json({
          status: true,
          message: "Action required",
          data: {
            token: null,
            action: {
              required: true,
              message: `Input 2FA code from <strong>${user.authenticator_label}</strong>`,
            },
            user: {},
          },
        });
      } else {
        const decryptedMfaSecret = await Users.methods.decryptMfaSecret(
          user.totp_secret
        );
        if (verifyTwoFactorToken(totp, decryptedMfaSecret)) {
          const token = await jwtr.sign(
            { userId: user.id, email: user.email, username: user.username },
            process.env.DEPLOYSTER_JSON_WEB_TOKEN_KEY,
            { expiresIn: "1d" }
          );

          signals.emit("updateUserLastActivityTime", {
            userId: user.id,
            timestamp: new Date().toISOString(),
          });

          return res.json({
            status: true,
            message: "Login successful",
            data: {
              token: token,
              action: null,
              user: {
                username: user.username,
                email: user.email,
                avatar: "",
              },
            },
          });
        } else {
          return res.json({
            status: false,
            message: "Invalid Authenticator code",
            data: {
              token: null,
              action: {
                required: true,
                message: `Input 2FA code from ${user.authenticator_label}`,
              },
              user: {},
            },
          });
        }
      }
    } else {
      const token = await jwtr.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
        },
        process.env.DEPLOYSTER_JSON_WEB_TOKEN_KEY,
        { expiresIn: "1d" }
      );

      signals.emit("updateUserLastActivityTime", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        status: true,
        message: "Login successful",
        data: {
          token: token,
          action: null,
          user: {
            username: user.username,
            email: user.email,
            avatar: "",
          },
        },
      });
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function logoutUser(req, res) {
  try {
    const token = req.headers.authorization;

    const verified = await jwtr.decode(token, process.env.JSON_WEB_TOKE_KEY);
    await jwtr.destroy(verified.jti);

    return res.json({
      status: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.log({ error });
    res.status(500).json({ status: false, message: "Internal server error" });
    return;
  }
}

async function getUser(req, res) {
  try {
    const user = req.user;

    return res.json({
      status: true,
      message: "User data returned successfully",
      data: {
        user: {
          username: user.username,
          email: user.email,
          avatar: "",
        },
      },
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getAllProjects(req, res) {
  try {
    const user = req.user;

    const projectCount = await getSingleRow(
      "SELECT COUNT(*) AS total_count FROM projects WHERE user_id = ?",
      [user.id]
    );

    let projects = await pool.all(
      `
        SELECT prjt.*, dep.finished_at
        FROM projects prjt
        INNER JOIN (
          SELECT project_id, MAX(finished_at) AS latest_finished_at
          FROM deployments
          GROUP BY project_id
        ) latest_dep
          ON latest_dep.project_id = prjt.id
        INNER JOIN deployments dep
          ON dep.project_id = latest_dep.project_id AND dep.finished_at = latest_dep.latest_finished_at
        WHERE prjt.user_id = ?
        ORDER BY dep.finished_at DESC
      `,
      [user.id]
    );

    projects = await Promise.all(
      projects.map(async (projectData) => {
        let pipelineJson = [];
        if (projectData.pipeline_json) {
          try {
            pipelineJson = JSON.parse(projectData.pipeline_json);
          } catch (error) {
            console.error(
              `Error parsing pipeline_json for project ${projectData.id}:`,
              error
            );
          }
        }

        const updatedPipelineJson = await Promise.all(
          pipelineJson.map(async (pipeline) => {
            const pipelinePort = await getPipelinePort(
              projectData.app_local_path,
              `${getProjectFolderNameFromPath(projectData.app_local_path)}--${
                pipeline.git_branch
              }`
            );
            return {
              ...pipeline,
              current_head: String(pipeline.current_head).slice(0, 7),
              tcp_port: pipelinePort,
              status: pipelinePort ? await isPortActive(pipelinePort) : null,
            };
          })
        );

        return {
          ...projectData,
          name: convertFolderNameToDocumentTitle(
            getProjectFolderNameFromPath(projectData.app_local_path)
          ),
          status: await isPortActive(projectData.tcp_port),
          pipeline_json: projectData.pipeline_json
            ? JSON.stringify(updatedPipelineJson)
            : null,
        };
      })
    );

    return res.json({
      status: true,
      message: "Projects returned successfully",
      count: projectCount.total_count,
      lastDeployment: Array.from(projects)[0]?.finished_at || "N?A",
      data: projects,
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getSingleProject(req, res) {
  const user = req.user;
  const projectId = req.params.projectId;

  let projectInView = await pool.get(
    `
        SELECT prjt.*, dep.finished_at
        FROM projects prjt
        INNER JOIN (
          SELECT project_id, MAX(finished_at) AS latest_finished_at
          FROM deployments
          GROUP BY project_id
        ) latest_dep
          ON latest_dep.project_id = prjt.id
        INNER JOIN deployments dep
          ON dep.project_id = latest_dep.project_id AND dep.finished_at = latest_dep.latest_finished_at
        WHERE prjt.user_id = ? AND prjt.id = ?
      `,
    [user.id, projectId]
  );

  projectInView = {
    ...projectInView,
    current_head: String(projectInView.current_head).slice(0, 7),
    name: convertFolderNameToDocumentTitle(
      getProjectFolderNameFromPath(projectInView.app_local_path)
    ),
    status: projectInView.tcp_port
      ? await isPortActive(projectInView.tcp_port)
      : null,
    deployster_conf: checkDeploysterConf(
      projectInView.app_local_path,
      getProjectPipelineJSON(projectInView.pipeline_json)
    ),
  };

  return res.json({
    status: true,
    message: "Project data returned successfully",
    data: projectInView,
  });
}

async function updateProjectDetails(req, res) {
  const user = req.user;
  const projectId = req.params.projectId;
  let projectInView;

  try {
    const { error } = updateProjectValidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: false,
        message: error.details[0].message,
      });
    }

    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, projectId]
      );
    } catch (error) {
      console.log({ error });
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    const { git_url, app_url, log_paths } = req.body;

    const [LOG_PATH_I, LOG_PATH_II, LOG_PATH_III] = log_paths;

    const pipelineStageUUID = req.query.pipelineStage;

    if (!pipelineStageUUID) {
      await pool.run(
        `
      UPDATE projects 
      SET 
        app_url = ?, 
        repository_url = ?,
        log_file_i_location = ?,
        log_file_ii_location = ?, 
        log_file_iii_location = ?
      WHERE id = ?
      `,
        [
          app_url,
          git_url,
          LOG_PATH_I || null,
          LOG_PATH_II || null,
          LOG_PATH_III || null,
          projectInView.id,
        ]
      );
    } else {
      const pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);

      const updatedPipeline = pipelineJson.map((pipelineStage) => {
        if (pipelineStage.stage_uuid == pipelineStageUUID) {
          return {
            ...pipelineStage,
            app_url: app_url,
            log_file_i_location: LOG_PATH_I,
            log_file_ii_location: LOG_PATH_II,
            log_file_iii_location: LOG_PATH_III,
          };
        } else {
          return pipelineStage;
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
        [JSON.stringify(updatedPipeline), projectInView.id]
      );
    }

    return res.json({
      status: true,
      message: "Project details updated successfully",
      data: {},
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getProjectDeploymentActivities(req, res) {
  const user = req.user;
  const projectId = req.params.projectId;
  const pipelineStageUUID = req.query.pipelineStage;
  let projectInView;
  let currentDeployment;
  let ACTIVITY_PIPELINE_ADDON_QUERY = "";
  let DEPLOYMENT_PIPELINE_ADDON_QUERY = "";

  try {
    // FETCH PROJECT WITH ID
    try {
      projectInView = await getSingleRow(
        `
        SELECT id
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, projectId]
      );
    } catch (error) {
      console.log({ error });
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    if (pipelineStageUUID) {
      ACTIVITY_PIPELINE_ADDON_QUERY = `AND dep.pipeline_stage_uuid = '${pipelineStageUUID}'`;
      DEPLOYMENT_PIPELINE_ADDON_QUERY = `AND pipeline_stage_uuid = '${pipelineStageUUID}'`;
    }

    const deploymentActivityLogs = await pool.all(
      `SELECT 
        ROW_NUMBER() OVER (ORDER BY actlog.id) AS sequential_id, 
        actlog.*,
        dep.commit_hash,
        dep.log_output,
        dep.pipeline_stage_uuid,
        dep.action,
        u.email 
      FROM activity_logs actlog 
      INNER JOIN deployments dep ON dep.id = actlog.deployment_id
      INNER JOIN users u ON u.id = dep.user_id 
      WHERE actlog.project_id = ? 
      ${ACTIVITY_PIPELINE_ADDON_QUERY}
      ORDER BY actlog.id DESC LIMIT 40`,
      [projectId]
    );

    try {
      currentDeployment = await getSingleRow(
        `SELECT * FROM deployments
          WHERE project_id = ?
            AND status = ?
            ${DEPLOYMENT_PIPELINE_ADDON_QUERY}
            AND id = (
              SELECT MAX(id) FROM deployments WHERE project_id = ? AND status = ?
            )
          LIMIT 1`,
        [
          projectId,
          DEPLOYMENT_STATUS.RUNNING,
          projectId,
          DEPLOYMENT_STATUS.RUNNING,
        ]
      );
    } catch (error) {
      if (error instanceof RecordDoesNotExist) {
        currentDeployment = null;
      }
    }

    return res.json({
      status: true,
      message: "Deployment activity data returned successfully",
      data: {
        deploymentActivityLogs,
        currentDeployment,
      },
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getActiveDeploymentLog(req, res) {
  const user = req.user;
  const projectId = req.params.projectId;
  const streamPoint = Number(req.query.streamPoint || 0);
  const deploymentId = req.params.deploymentId;
  let projectInView;

  try {
    // FETCH PROJECT WITH ID
    try {
      projectInView = await getSingleRow(
        `
        SELECT id
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, projectId]
      );
    } catch (error) {
      console.log({ error });
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    try {
      const deploymentInView = await getSingleRow(
        `SELECT * FROM deployments
          WHERE 
            user_id = ?
            AND project_id = ?
            AND id = ?
            AND status = ?
            AND id = (
              SELECT MAX(id) FROM deployments WHERE project_id = ? AND status = ?
            )
          LIMIT 1`,
        [
          user.id,
          projectId,
          deploymentId,
          DEPLOYMENT_STATUS.RUNNING,
          projectId,
          DEPLOYMENT_STATUS.RUNNING,
        ]
      );

      const logOutput = deploymentInView.log_output.replace(/\\n/g, "\n");

      const logLines = logOutput.split("\n");

      const newLines = logLines.slice(streamPoint);

      return res.json({
        status: true,
        message: "Deployment log returned successfully",
        data: {
          log_output: newLines.join("\n"),
          new_line_count: newLines.length,
          status: deploymentInView.status,
        },
      });
    } catch (error) {
      if (error instanceof RecordDoesNotExist) {
        return res
          .status(403)
          .json({ status: false, message: "Error getting deployment record" });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function streamLogFile(req, res) {
  const user = req.user;
  let resolvedPath;
  try {
    const fromLine = parseInt(req.query.fromLine || -1);
    let safeFromLine = 0;
    const limit = parseInt(req.query.limit || 1000);
    const filePathRaw = req.query.path;

    if (!filePathRaw) {
      return res
        .status(400)
        .json({ status: false, message: "Log File path is required" });
    }

    try {
      const expandedPath = expandTilde(filePathRaw);
      resolvedPath = path.resolve(expandedPath);
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return res
          .status(400)
          .json({ status: false, message: "Path is not a file" });
      }
    } catch (err) {
      return res.status(404).json({ status: false, message: "File not found" });
    }

    const totalLines = await getTotalLinesFromFile(resolvedPath);
    // console.log({ fromLine, limit });
    if (fromLine <= 0) {
      // Auto jump to tail if fromLine is -1
      // This also ensures all request starts from central point 0 going before going forward or backward
      safeFromLine = Math.max(0, totalLines - limit);
    } else {
      safeFromLine = Math.min(fromLine, totalLines);
    }

    // Adjust limit so we don't read past EOF
    const adjustedLimit = Math.max(
      0,
      Math.min(limit, totalLines - safeFromLine)
    );

    let lines;

    if (adjustedLimit == 0) {
      lines = [];
    } else {
      lines = await getLogContentFromFile(
        resolvedPath,
        safeFromLine,
        adjustedLimit
      );
    }

    // console.log({
    //   totalLines,
    //   safeFromLine,
    //   limit,
    //   end: safeFromLine + adjustedLimit,
    // });

    return res.json({
      status: true,
      message: "Data returned successfully",
      data: {
        lines,
        fromLine: safeFromLine,
        nextLineIndex: safeFromLine + lines.length,
        totalLines,
      },
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function spinUpOrKillServer(req, res) {
  try {
    const { error } = serverActionValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    let projectInView;
    const { project_id, action, stage_uuid } = req.body;

    try {
      projectInView = await getSingleRow(
        `
        SELECT id
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, project_id]
      );
    } catch (error) {
      console.log({ error });
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    const response = await serverActionHandler(
      projectInView.id,
      action,
      stage_uuid ?? null
    );

    if (response.status) {
      return res.json(response);
    } else {
      return res.status(403).json(response);
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function bashAccessVerification(req, res) {
  try {
    const { error } = bashAccessValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    const { system_username, deployster_password } = req.body;

    const passwordMatch = await bcrypt.compare(
      deployster_password,
      user.password
    );
    if (!passwordMatch) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid deployster password" });
    } else {
      return res.json({
        status: true,
        message: "Deployster GUI access verified",
        data: {},
      });
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getListOfProjectPipelineJson(req, res) {
  const user = req.user;
  const projectId = req.params.projectId;
  let projectInView;

  try {
    // FETCH PROJECT WITH ID
    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, projectId]
      );
    } catch (error) {
      console.log({ error });
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    let pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);

    if (pipelineJson) {
      if (pipelineJson) {
        pipelineJson = await Promise.all(
          pipelineJson.map(async (pipeline) => {
            try {
              const pipelinePort = await getPipelinePort(
                projectInView.app_local_path,
                `${getProjectFolderNameFromPath(
                  projectInView.app_local_path
                )}--${pipeline.git_branch}`
              );
              return {
                ...pipeline,
                current_head: String(pipeline.current_head).slice(0, 7),
                tcp_port: pipelinePort,
                status: pipelinePort ? await isPortActive(pipelinePort) : null,
              };
            } catch (error) {
              console.error(
                `Error processing pipeline ${pipeline.git_branch}:`,
                error
              );
              return {
                ...pipeline,
                current_head: String(pipeline.current_head).slice(0, 7),
                tcp_port: null,
                status: null,
              };
            }
          })
        );
      }
    }

    return res.json({
      status: true,
      message: "Project pipeline returned successfully",
      data: pipelineJson,
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function addNewPipelineJsonRecord(req, res) {
  try {
    const { error } = pipelineJsonValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    const { project_id, data } = req.body;
    let projectInView;

    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, project_id]
      );
    } catch (error) {
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    const pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);
    if (pipelineJson) {
      const duplicateStage = data.find((stage) => {
        const { stage_name, git_branch } = stage;
        return pipelineJson.some(
          (existingStage) =>
            existingStage.stage_name === capitalizeFirstLetter(stage_name) ||
            existingStage.git_branch === String(git_branch).toLowerCase()
        );
      });

      if (duplicateStage) {
        return res.status(403).json({
          status: false,
          message: "Git branch or stage name already used",
        });
      }
    }

    let pipelines;
    if (pipelineJson) {
      pipelines = [...pipelineJson];
    } else {
      pipelines = [];
    }

    // PROCEED
    await data.reduce(async (prevPromise, stage) => {
      {
        /** Ensure the previous transaction finishes */
      }
      await prevPromise;
      {
        /** */
      }
      pipelines.push({
        stage_uuid: uuidv4(),
        stage_name: capitalizeFirstLetter(stage.stage_name),
        git_branch: String(stage.git_branch).toLowerCase(),
        environment_variables: stage.environment_variables,
        tcp_port: null,
        current_head: null,
        app_url: null,
        log_file_i_location: null,
        log_file_ii_location: null,
        log_file_iii_location: null,
      });

      return Promise.resolve();
    }, Promise.resolve());

    // UPDATE PROJECT DETAILS
    await pool.run(
      `
      UPDATE projects 
      SET 
        pipeline_json = ? 
      WHERE id = ?
      `,
      [JSON.stringify(pipelines), projectInView.id]
    );

    return res.json({
      status: true,
      message: "Project details updated successfully",
      data: {},
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function editProjectPipelineJsonRecord(req, res) {
  try {
    const { error } = updateExistingPipelineJsonValidationSchema.validate(
      req.body
    );
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    const { project_id, stage_uuid, data } = req.body;
    let projectInView;

    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, project_id]
      );
    } catch (error) {
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    const pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);
    let pipelineStageInView;
    if (pipelineJson) {
      pipelineStageInView = pipelineJson.find((stage) => {
        const { stage_uuid } = stage;
        return pipelineJson.find(
          (existingStage) => existingStage.stage_uuid === String(stage_uuid)
        );
      });

      if (!pipelineStageInView) {
        return res.status(403).json({
          status: false,
          message: "Unable to reconcile stage UUID",
        });
      }
    } else {
      return res.status(403).json({
        status: false,
        message: "Project has no active pipeline record",
      });
    }

    // CHECK THAT NEW UPDATE DOESN'T CLASH WITH OTHER EXISTING RECORD

    const duplicateStage = pipelineJson.find((existingStage) => {
      return (
        (existingStage.stage_name == data.stage_name ||
          existingStage.git_branch == data.git_branch) &&
        existingStage.stage_uuid !== stage_uuid
      );
    });

    if (duplicateStage) {
      return res.status(403).json({
        status: false,
        message: "Git branch or stage name already used",
      });
    }

    /**
     *  ITs IMPERATIVE TO ENSURE THAT git branch name in the supervisor configuration is updated cleanly.
     * This is because the branch name is critical for the supervisor conf file, and each pipeline stage must maintain it.
     * If a branch name change of an existing pipeline is required, the existing service must be stopped to avoid control issues.
     */
    if (pipelineStageInView.git_branch !== data.git_branch) {
      await serverActionHandler(projectInView.id, "kill", stage_uuid);
    }

    const updatedPipeline = pipelineJson.map((pipelineStage) => {
      if (pipelineStage.stage_uuid == stage_uuid) {
        return {
          stage_uuid,
          stage_name: capitalizeFirstLetter(data.stage_name),
          git_branch: String(data.git_branch).toLowerCase(),
          environment_variables: data.environment_variables,
          tcp_port: pipelineStage.tcp_port,
          current_head: pipelineStage.current_head,
          app_url: pipelineStage.app_url,
          log_file_i_location: pipelineStage.log_file_i_location,
          log_file_ii_location: pipelineStage.log_file_ii_location,
          log_file_iii_location: pipelineStage.log_file_iii_location,
        };
      } else {
        return pipelineStage;
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
      [JSON.stringify(updatedPipeline), projectInView.id]
    );

    return res.json({
      status: true,
      message: "Project details updated successfully",
      data: {},
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function deleteProjectPipelineJsonRecord(req, res) {
  try {
    const { error } = deleteExistingPipelineJsonValidationSchema.validate(
      req.body
    );
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    const { project_id, stage_uuid } = req.body;
    let projectInView;

    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, project_id]
      );
    } catch (error) {
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    const pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);
    let pipelineStageInView;
    if (pipelineJson) {
      pipelineStageInView = pipelineJson.find((stage) => {
        const { stage_uuid } = stage;
        return pipelineJson.find(
          (existingStage) => existingStage.stage_uuid === String(stage_uuid)
        );
      });

      if (!pipelineStageInView) {
        return res.status(403).json({
          status: false,
          message: "Unable to reconcile stage UUID",
        });
      }
    } else {
      return res.status(403).json({
        status: false,
        message: "Project has no active pipeline record",
      });
    }

    // KILL ASSOCIATED SERVER
    const serverActionResponse = await serverActionHandler(
      projectInView.id,
      "kill",
      stage_uuid
    );

    if (serverActionResponse) {
      const updatedPipeline = pipelineJson.filter(
        (pipelineStage) => pipelineStage.stage_uuid != stage_uuid
      );

      // UPDATE PROJECT DETAILS
      await pool.run(
        `
      UPDATE projects 
      SET 
        pipeline_json = ?
      WHERE id = ?
      `,
        [JSON.stringify(updatedPipeline), projectInView.id]
      );

      return res.json({
        status: true,
        message: "Pipeline stage deleted successfully",
        data: {},
      });
    } else {
      return res
        .status(403)
        .json({ status: false, message: "Error killing server" });
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function rollbackToCommitSnapshot(req, res) {
  try {
    const { error } = rollbackToCommitValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      res.json({
        status: false,
        message: error.details[0].message,
      });
      return;
    }

    const user = req.user;
    const { project_id, stage_uuid, commit_hash } = req.body;
    let projectInView;
    let deploymentLockKey;
    let deploymentRecord;
    let pipelineStageInView;
    let PIPELINE_SQL_DEPLOYMENT_FILTER = "";
    let specificDeploymentInView;
    let backupFileLocation;
    const deploymentTimestamp = moment().format("YYYY-MM-DD HH:mm:ss");
    const job_id = Date.now().toString();

    try {
      projectInView = await getSingleRow(
        `
        SELECT *
        FROM projects
        WHERE user_id = ? AND id = ?
      `,
        [user.id, project_id]
      );
    } catch (error) {
      return res
        .status(403)
        .json({ status: false, message: "Error getting project" });
    }

    try {
      // GENERATE DEPLOYMENT LOCK KEY
      deploymentLockKey = `lock:deploy:${projectInView.id}`;
      const acquired = await ioRedisClient.set(
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
      return res
        .status(403)
        .json({ status: false, message: "Error getting deployment lock key" });
    }

    await ioRedisClient.set(`job:${job_id}:status`, "queued");
    await ioRedisClient.del(`job:${job_id}:logs`);

    try {
      await ioRedisClient.set(`job:${job_id}:status`, "running");

      // CREATE DEPLOYMENT RECORD LOG
      deploymentRecord = await createRowAndReturn(
        "deployments",
        "INSERT INTO deployments (user_id, project_id, commit_hash, pipeline_stage_uuid, action, status, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          user.id,
          projectInView.id,
          commit_hash,
          stage_uuid ?? null,
          "ROLLBACK",
          "RUNNING",
          deploymentTimestamp,
        ]
      );
      var newLogMessage = "\n[INFO] Deployment record created\n";
      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (error) {
      var errorOutput = `[ERROR] Error recording deployment log: ${error}`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );
      return res
        .status(403)
        .json({ status: false, message: "Error recording deployment log" });
    }

    if (stage_uuid) {
      const pipelineJson = getProjectPipelineJSON(projectInView.pipeline_json);
      if (pipelineJson) {
        pipelineStageInView = pipelineJson.find((stage) => {
          const { stage_uuid } = stage;
          return pipelineJson.find(
            (existingStage) => existingStage.stage_uuid === String(stage_uuid)
          );
        });

        if (!pipelineStageInView) {
          var errorOutput = `[ERROR] Unable to reconcile stage UUID - ${stage_uuid}\n`;
          await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
          await ioRedisClient.set(`job:${job_id}:status`, "failed");
          await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
          await markDeploymentAsComplete(
            deploymentRecord.id,
            DEPLOYMENT_STATUS.FAILED,
            null,
            deploymentLockKey
          );
          return res.status(403).json({
            status: false,
            message: "Unable to reconcile stage UUID",
          });
        }

        var newLogMessage = `\n[INFO] Stage UUID - ${stage_uuid} processing\n`;
        await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
        await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
      } else {
        var errorOutput = `[ERROR] Project has no active pipeline record\n`;
        await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
        await ioRedisClient.set(`job:${job_id}:status`, "failed");
        await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
        await markDeploymentAsComplete(
          deploymentRecord.id,
          DEPLOYMENT_STATUS.FAILED,
          null,
          deploymentLockKey
        );
        return res.status(403).json({
          status: false,
          message: "Project has no active pipeline record",
        });
      }

      PIPELINE_SQL_DEPLOYMENT_FILTER = `AND pipeline_stage_uuid = '${stage_uuid}'`;
    }

    var newLogMessage = `\n[INFO] Getting specific deployment record\n`;
    await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
    await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

    try {
      specificDeploymentInView = await getSingleRow(
        `SELECT * FROM deployments WHERE project_id = ? AND commit_hash = ? AND status = ? AND action = ? ${PIPELINE_SQL_DEPLOYMENT_FILTER}`,
        [projectInView.id, commit_hash, "COMPLETED", "DEPLOY"]
      );

      var newLogMessage = `\n[INFO] Deployment record - ${specificDeploymentInView.id} obtained\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] Error getting deployment record: ${err}\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );
      return res
        .status(403)
        .json({ status: false, message: "Error getting deployment record" });
    }

    if (specificDeploymentInView.artifact_path) {
      backupFileLocation = specificDeploymentInView.artifact_path;
    } else {
      var errorOutput = `[ERROR] Error getting project/pipeline artifact path\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );

      return res
        .status(403)
        .json({ status: false, message: "Error getting artifact path" });
    }

    // Reset Git HEAD
    try {
      var newLogMessage = await runShell(
        `cd ${projectInView.app_local_path} && git reset --hard ${commit_hash}`
      );

      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );
    }

    // Clean up files except .git
    const files = fs.readdirSync(projectInView.app_local_path);
    for (const file of files) {
      if (![".git"].includes(file)) {
        const fullPath = path.join(projectInView.app_local_path, file);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }

    // Restore files from the backup
    try {
      var newLogMessage = await runShell(
        `tar -xzf "${backupFileLocation}" -C "${projectInView.app_local_path}"`
      );
      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );
    }

    try {
      // STOP server
      serverActionHandler(
        projectInView.id,
        "kill",
        pipelineStageInView?.stage_uuid
      );

      var newLogMessage = `\n[INFO] Server stopped && rebooting\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

      // REDEPLOY
      serverActionHandler(
        projectInView.id,
        "redeploy",
        pipelineStageInView?.stage_uuid
      );

      var newLogMessage = `\n[INFO] Server restarted successfully\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await ioRedisClient.append(`job:${job_id}:logs`, errorOutput);
      await ioRedisClient.set(`job:${job_id}:status`, "failed");
      await addLogToDeploymentRecord(deploymentRecord.id, errorOutput);
      await markDeploymentAsComplete(
        deploymentRecord.id,
        DEPLOYMENT_STATUS.FAILED,
        null,
        deploymentLockKey
      );
    }

    if (pipelineStageInView) {
      var newLogMessage = await updatePipelineGitHead(
        projectInView.id,
        pipelineStageInView.git_branch,
        commit_hash
      );
      await addLogToDeploymentRecord(
        deploymentRecord.id,
        `\n${newLogMessage}\n`
      );
    } else {
      await pool.run("UPDATE projects SET current_head = ? WHERE id = ?", [
        commit_hash,
        projectInView.id,
      ]);
    }

    await ioRedisClient.set(`job:${job_id}:status`, "complete");

    // Clear the logs from Redis upon completion
    await ioRedisClient.del(`job:${job_id}:logs`);

    await markDeploymentAsComplete(
      deploymentRecord.id,
      DEPLOYMENT_STATUS.COMPLETED,
      null,
      deploymentLockKey
    );

    return res.json({
      status: true,
      message: "Project details updated successfully",
      data: {},
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function redisOverviewData(req, res) {
  try {
    // CHECK REDIS IS INSTALLED
    const DEFAULT_PORT = 6379;
    const command = "redis-server --version";
    let redisAvailable;

    try {
      const output = await runShell(command);
      redisAvailable = true;
    } catch (err) {
      redisAvailable = false;
      //console.error("Redis is not installed or not in PATH.");
    }

    // CHECK DEFAULT PORT IS ONLINE
    async function redisPortIsOnline(port) {
      return new Promise((resolve, reject) => {
        // const portIsOnlineCommand = `lsof -i :${DEFAULT_PORT} -sTCP:LISTEN -nP`;

        const client = net.createConnection({ port }, () => {
          // Send Redis PING command using RESP format
          client.write("*1\r\n$4\r\nPING\r\n");
        });

        client.on("data", (data) => {
          const response = data.toString();
          if (response.includes("PONG")) {
            resolve(true); // Redis is responding correctly
          } else {
            resolve(false); //PORT is active, but it's not Redis
          }
          client.end();
        });

        client.on("error", (err) => {
          resolve(false); // PORT unreachable / Offline
        });

        client.on("end", () => {});

        client.setTimeout(2000, () => {
          // Timeout after 2 seconds
          client.destroy();
          resolve(false);
        });
      });
    }

    let servers = [
      {
        id: 0,
        name: "Default Redis",
        port: DEFAULT_PORT,
        portIsActive: await redisPortIsOnline(DEFAULT_PORT),
        metadata:
          "Redis uses port 6379 as its default TCP port for client connections. This is the standard port the Redis server listens on unless explicitly configured otherwise",
        created_at: null,
        uri: `redis://${DEPLOYSTER_VPS_PUBLIC_IP}:${DEFAULT_PORT}`,
        logPath: "/var/log/redis/redis-server.log",
      },
    ];

    const redisServers = await pool.all(`
      SELECT 
        id,
        name,
        port,
        metadata,
        created_at
      FROM managed_redis_server
    `);

    await Promise.all(
      redisServers.map(async (data) => {
        servers.push({
          ...data,
          portIsActive: await redisPortIsOnline(data.port),
          uri: `redis://${DEPLOYSTER_VPS_PUBLIC_IP}:${data.port}`,
          logPath: path.join(
            __dirname,
            `../logs/deployster-redis${data.port}.log`
          ),
        });
      })
    );

    return res.json({
      status: true,
      message: "Redis overview returned successfully",
      data: {
        redisAvailable,
        servers,
        count: servers.length,
      },
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function createNewRedisInstance(req, res) {
  try {
    const { error } = createRedisInstanceValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const user = req.user;
    const DEFAULT_REDIS_PORT = 6379;
    const { name, port, description } = req.body;

    if (port == DEFAULT_REDIS_PORT) {
      return res.status(403).json({
        status: false,
        message:
          "Default redis port cannot be recreated. Restart instance instead",
      });
    }

    // ACERTAIN THAT PORT HAS NOT BEEN REGISTERED PRIOR

    try {
      const existingRecord = await getSingleRow(
        `
        SELECT *
        FROM managed_redis_server
        WHERE port = ?
      `,
        [port]
      );

      if (existingRecord) {
        return res.status(403).json({
          status: false,
          message: `Port: ${port} already created. Restart instance instead`,
        });
      }
    } catch (error) {
      //PASS
    }

    // UPDATE PROJECT DETAILS
    await pool.run(
      `INSERT INTO managed_redis_server (name, port, metadata) VALUES (?, ?, ?) `,
      [name, port, description]
    );

    const createdInstance = await startRedisServer(port);

    if (createdInstance) {
      return res.json({
        status: true,
        message: "Redis instance created and started successfully",
        data: {},
      });
    } else {
      return res.json({
        status: true,
        message: "Redis instance created. Error starting successfully",
        data: {},
      });
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function redisInstanceAdmin(req, res) {
  try {
    const { error } = redisClientAdminOptionValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const user = req.user;
    const redisInstanceId = req.params.instanceId;
    const { action } = req.body;
    let redisInstanceInView;

    // GET REDIS INSTANCE
    if (redisInstanceId == 0) {
      // ID Zero (0) or null is dedicated to Default PORT
      const DEFAULT_PORT = 6379;
      redisInstanceInView = {
        port: DEFAULT_PORT,
      };
    } else {
      try {
        redisInstanceInView = await getSingleRow(
          `
        SELECT *
        FROM managed_redis_server
        WHERE id = ?
      `,
          [redisInstanceId]
        );
      } catch (error) {
        return res.status(403).json({
          status: false,
          message: `Error fetching Redis instance with ID: ${redisInstanceId}`,
        });
      }
    }

    if (action == "redeploy") {
      const createdInstance = await startRedisServer(redisInstanceInView.port);

      if (createdInstance) {
        return res.json({
          status: true,
          message: "Redis instance created and started successfully",
          data: {},
        });
      } else {
        return res.json({
          status: true,
          message: "Redis instance created. Error starting successfully",
          data: {},
        });
      }
    } else if (action == "kill") {
      const response = await killRedisServer(redisInstanceInView.port);
      console.log({ response });
      if (response) {
        return res.json({
          status: true,
          message: "Redis instance stopped successfully",
          data: {},
        });
      }
      return res.json({
        status: true,
        message: "Error stopping service",
        data: {},
      });
    }
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getPostgresClusters(req, res) {
  try {
    const user = req.user;

    const pgVersions = await listPostgresClusters();

    return res.json({
      status: true,
      message: "Postgres clusters returned successfully",
      count: pgVersions.length ?? 0,
      data: pgVersions,
      dbVisualiserAuthRequired:
        typeof (await getPostgresCredentials()) === "undefined",
    });
  } catch (error) {
    console.log({ error });
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function setPostgresDatabasePass(req, res) {
  try {
    const { error } = databaseCredentialsValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const { username, password, port } = req.body;

    try {
      const host = "localhost";
      const database = "postgres"; // default

      const output = await runShell(
        `psql -h ${host} -p ${port} -U ${username} -d ${database} -t -A -c "SELECT version();"`,
        {
          env: { ...process.env, PGPASSWORD: password }, // Passing the password like this instead of (link format) help clean the bash history of direct exposure of the password
        }
      );

      if (output && output.includes("PostgreSQL")) {
        await ioRedisClient.set(PG_PASSWORD_KEY, password, "EX", PASSWORD_TTL);
        await ioRedisClient.set(PG_USERNAME_KEY, username, "EX", PASSWORD_TTL);
        await ioRedisClient.set(PG_CLUSTER, port, "EX", PASSWORD_TTL);
        const pgCredentials = await getPostgresCredentials(port);
        return res.status(200).json({
          success: true,
          message: `Connection successful (v${output.trim()}). Password stored for 10 minutes`,
          data: {},
          dbVisualiserAuthRequired: typeof pgCredentials === "undefined",
        });
      } else {
        return res.status(403).json({
          success: false,
          message: "Could not verify PostgreSQL version",
        });
      }
    } catch (err) {
      if (err.message?.includes("password authentication failed")) {
        return res
          .status(403)
          .json({ success: false, message: "Invalid DB username or password" });
      }
      if (err.message?.includes("could not connect")) {
        return res
          .status(403)
          .json({ success: false, message: "Cannot reach PostgreSQL server" });
      }

      throw err;
    }
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getPostgresClusterAnalytics(req, res) {
  try {
    const pgData = req.pgData;

    const versionOutput = await runShell(
      `psql -h localhost -p ${pgData.clusterPort} -U ${pgData.pgCredentials.username} -d postgres -t -A -c "SELECT version();"`,
      {
        env: { ...process.env, PGPASSWORD: pgData.pgCredentials.password },
      }
    );

    let clusterFullName;
    let clusterStatus;

    if (versionOutput && versionOutput.includes("PostgreSQL")) {
      clusterFullName = versionOutput.trim().split(",")[0];
      clusterFullName = clusterFullName.split("on")[0];
      clusterStatus = true;
    } else {
      clusterFullName = "N?A";
      clusterStatus = false;
    }

    var query = `SELECT now() - pg_postmaster_start_time() AS uptime;`;
    const pgUptime = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database: "postgres",
      query,
    });

    var query = `
    SELECT count(*) FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    AND client_addr IS NOT NULL
    AND usename IS NOT NULL;`;

    const totalConnections = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database: "postgres",
      query,
    });

    var query = `
    SELECT pid, usename, datname, client_addr, state, backend_start, query_start
    FROM pg_stat_activity 
    WHERE pid <> pg_backend_pid()
    AND usename IS NOT NULL
    AND client_addr IS NOT NULL
    AND state IS NOT NULL
    ORDER BY backend_start;
  `;

    const connectionString = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database: "postgres",
      query,
    });

    const connectionList = connectionString
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [
          pid,
          usename,
          datname,
          client_addr,
          state,
          backend_start,
          query_start,
        ] = line.split("|");
        return {
          pid,
          usename,
          datname,
          client_addr,
          state,
          backend_start,
          query_start,
        };
      });

    var query = `SELECT 
    datname,
    pg_database_size(datname) AS size
    FROM pg_database WHERE datallowconn;
  `;

    const database = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database: "postgres",
      query,
    });

    let totalBytes = 0;

    const databases = database
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [datname, size] = line.split("|");
        totalBytes += Number(size);
        return {
          datname,
          size: convertBytesToHumanReadableFileSize(size),
        };
      });

    const totalClusterSize = convertBytesToHumanReadableFileSize(totalBytes);

    const analytics = {
      clusterFullName,
      clusterStatus,
      totalClusterSize,
      version: pgData.version,
      uptime: formatDatabaseLiveDuration(pgUptime),
      totalConnections,
      connectionList,
      databases,
    };

    return res.status(200).json({
      status: true,
      message: "Analytics returned successfully",
      data: analytics,
      dbVisualiserAuthRequired: false,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function disconnectIdlePgConnection(req, res) {
  try {
    const { error } = disconnectIdlePgConnectionValidationSchema.validate(
      req.body
    );
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const pgData = req.pgData;
    const { pid } = req.body;

    const query = `SELECT pg_terminate_backend(${pid})`;

    const output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database: "postgres",
      query,
    });

    if (output.includes("t")) {
      return res.json({
        success: true,
        message: `Connection ${pid} terminated.`,
        dbVisualiserAuthRequired: false,
      });
    } else {
      return res.status(503).json({
        success: false,
        message: `Failed to terminate connection ${pid}.`,
        dbVisualiserAuthRequired: false,
      });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
}

async function getPgDatabaseQuickSummary(req, res) {
  try {
    const pgData = req.pgData;
    const database = req.params?.database;

    const tableListQuery = `
      SELECT
        n.nspname AS schema,
        c.relname AS table_name,
        c.reltuples AS row_count,
        pg_total_relation_size(c.oid) AS total_size
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC;
      `;

    var output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query: tableListQuery,
      csvOutput: true,
    });

    tables = await csvParse(output, {
      columns: true,
      skip_empty_lines: true,
    });

    const updatedTables = await Promise.all(
      tables.map(async (data) => {
        if (
          data.schema === "public" &&
          data.row_count != null &&
          Number(data.row_count) < 100_000
        ) {
          try {
            const tableRowCount = await runNativePsqlQuery({
              host: "localhost",
              port: pgData.clusterPort,
              user: pgData.pgCredentials.username,
              password: pgData.pgCredentials.password,
              database,
              query: `SELECT COUNT(*) AS row_count FROM ${data.table_name}`,
            });

            return {
              ...data,
              row_count: tableRowCount ?? data.row_count,
              total_size: convertBytesToHumanReadableFileSize(data.total_size),
            };
          } catch (error) {
            //console.error(`Error querying ${data.table_name}:`, error);
            return {
              ...data,
              total_size: convertBytesToHumanReadableFileSize(data.total_size),
            };
          }
        } else {
          return {
            ...data,
            total_size: convertBytesToHumanReadableFileSize(data.total_size),
          };
        }
      })
    );

    tables = updatedTables;

    const indexQuery = `
      SELECT
          n.nspname AS schema,
          t.relname AS table_name,
          i.relname AS index_name,
          pg_get_indexdef(i.oid) AS definition,
          pg_size_pretty(pg_relation_size(i.oid)) AS index_size,

          CASE
              WHEN ix.indisunique THEN 'UNIQUE'
              ELSE 'NON-UNIQUE'
          END AS uniqueness,

          CASE
              WHEN pg_get_indexdef(i.oid) ILIKE '%USING btree%'  THEN 'BTREE'
              WHEN pg_get_indexdef(i.oid) ILIKE '%USING gin%'    THEN 'GIN'
              WHEN pg_get_indexdef(i.oid) ILIKE '%USING gist%'   THEN 'GIST'
              WHEN pg_get_indexdef(i.oid) ILIKE '%USING spgist%' THEN 'SPGIST'
              WHEN pg_get_indexdef(i.oid) ILIKE '%USING hash%'   THEN 'HASH'
              ELSE 'OTHER'
          END AS index_type,

          CASE
              WHEN EXISTS (
                  SELECT 1
                  FROM pg_constraint c
                  WHERE c.conindid = i.oid
                    AND c.contype = 'p'
              )
              THEN 'YES'
              ELSE 'NO'
          END AS is_primary_key

      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, t.relname, i.relname;
    `;

    var output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query: indexQuery,
      csvOutput: true,
    });

    indexes = await csvParse(output, {
      columns: true,
      skip_empty_lines: true,
    });

    const constraintQuery = `
      SELECT
        con.conname AS constraint_name,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'::text
          WHEN 'f' THEN 'FOREIGN KEY'::text
          WHEN 'u' THEN 'UNIQUE'::text
          WHEN 'c' THEN 'CHECK'::text
          WHEN 'x' THEN 'EXCLUSION'::text
          ELSE con.contype
        END AS constraint_description,
        nsp.nspname AS schema,
        rel.relname AS table_name,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      ORDER BY nsp.nspname, rel.relname, con.conname;
    `;

    var output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query: constraintQuery,
      csvOutput: true,
    });

    const constraints = await csvParse(output, {
      columns: true,
      skip_empty_lines: true,
    });

    return res.status(200).json({
      success: true,
      message: `Data returned successfully.`,
      data: {
        tables,
        indexes,
        constraints,
      },
      dbVisualiserAuthRequired: false,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function runPgDbQuery(req, res) {
  try {
    const { error } = databaseQueryValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const pgData = req.pgData;
    const { query } = req.body;
    const database = req.params.database;

    cleanedQuery = cleanSqlQuery(query);

    const start = Date.now();

    const output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query,
      csvOutput: true,
    });

    const duration = Date.now() - start;

    // Split output into lines
    const lines = output.split("\n").filter(Boolean);

    let command = "SELECT";
    let rowCount = 0;
    let rows = [];

    const dmlMatch = lines.find((line) =>
      /^\s*(INSERT|UPDATE|DELETE)\s+\d+/i.test(line)
    );

    if (dmlMatch) {
      const [cmdWord, affected] = dmlMatch.split(" ");
      command = cmdWord;
      rowCount = Number(affected);
    } else if (lines.length) {
      // Parse CSV rows
      // const header = lines[0].split(",");
      // rows = lines.slice(1).map((line) => {
      //   const values = line.split(",");
      //   const row = {};
      //   header.forEach((col, i) => (row[col] = values[i]));
      //   return row;
      // });

      rows = await csvParse(output, {
        columns: true, // Use header row as keys
        skip_empty_lines: true,
      });
      rowCount = rows.length;
    }

    return res.json({
      success: true,
      message: "Query ran successfully",
      data: {
        command,
        rows,
        rowCount,
        duration,
      },
      dbVisualiserAuthRequired: false,
    });
  } catch (error) {
    const isPsqlError = /ERROR:|FATAL:|psql:/i.test(error.message);

    if (isPsqlError) {
      return res.status(422).json({
        status: false,
        type: "psql",
        message: "PostgreSQL query failed",
        data: {
          duration: 0,
          error: error.message,
        },
        dbVisualiserAuthRequired: false,
      });
    } else {
      return res.status(500).json({
        status: false,
        type: "general",
        message: "Internal server error",
        data: {
          error: error.message || "Unknown error occurred",
        },
        dbVisualiserAuthRequired: false,
      });
    }
  }
}

async function getPgTableQuickSummary(req, res) {
  try {
    const pgData = req.pgData;
    const database = req.params?.database;
    const schema = req.params?.schema;
    const table = req.params?.table;

    const tableListQuery = `
      SELECT
        c.relname AS table_name,
        c.reltuples::bigint AS row_count,
        pg_total_relation_size(c.oid) AS size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = '${schema}'
        AND c.relname = '${table}'
        AND c.relkind = 'r';
      `;

    var output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query: tableListQuery,
      csvOutput: true,
    });

    const tableData = await csvParse(output, {
      columns: true,
      skip_empty_lines: true,
    })[0];

    const rowCount = Number(tableData?.row_count);

    if (rowCount && rowCount < 100_000) {
      const tableRowCount = await runNativePsqlQuery({
        host: "localhost",
        port: pgData.clusterPort,
        user: pgData.pgCredentials.username,
        password: pgData.pgCredentials.password,
        database,
        query: `SELECT COUNT(*) AS row_count FROM ${table}`,
      });

      tableData.row_count = tableRowCount;
    }

    tableData.size = convertBytesToHumanReadableFileSize(tableData.size);

    const metaDataQuery = `
    SELECT
        cols.column_name,
        format_type(a.atttypid, a.atttypmod) AS formatted_data_type,
        cols.udt_name,
        cols.data_type,
        cols.character_maximum_length AS max_length,
        cols.numeric_precision AS precision,
        cols.numeric_scale AS scale,
        cols.is_nullable,
        cols.column_default,
        pgd.description,
        CASE 
            WHEN pk.column_name IS NOT NULL THEN true 
            ELSE false 
        END AS is_primary_key
    FROM information_schema.columns cols
    JOIN pg_class c ON c.relname = cols.table_name
    JOIN pg_attribute a 
         ON a.attrelid = c.oid 
        AND a.attname = cols.column_name
    LEFT JOIN pg_catalog.pg_statio_all_tables st 
         ON st.relname = cols.table_name
    LEFT JOIN pg_catalog.pg_description pgd 
         ON pgd.objoid = st.relid 
        AND pgd.objsubid = cols.ordinal_position
    LEFT JOIN (
        SELECT 
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = '${schema}'
          AND tc.table_name = '${table}'
          AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON pk.column_name = cols.column_name
    WHERE cols.table_schema = '${schema}'
      AND cols.table_name = '${table}'
    ORDER BY cols.ordinal_position;
`;

    var output = await runNativePsqlQuery({
      host: "localhost",
      port: pgData.clusterPort,
      user: pgData.pgCredentials.username,
      password: pgData.pgCredentials.password,
      database,
      query: metaDataQuery,
      csvOutput: true,
    });

    const metaData = await csvParse(output, {
      columns: true,
      skip_empty_lines: true,
    });

    return res.status(200).json({
      success: true,
      message: `Data returned successfully.`,
      data: {
        table: tableData,
        metaData,
      },
      dbVisualiserAuthRequired: false,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function getSysMonitorAnalytics(req, res) {
  try {
    const tsRange = req.query.tsRange || "15m";

    // Get Computer name
    var output = await runShell("hostname");
    const hostname = output.trim();

    // GET RAM
    var output = await runShell("free -b");
    const freeCheckOutput = output.trim();

    var lines = freeCheckOutput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const memLine = lines.find((l) => l.toLowerCase().startsWith("mem:"));
    if (!memLine) return null;
    const parts = memLine.split(/\s+/);
    const total = Number(parts[1]);
    const used = Number(parts[2]);
    const free = Number(parts[3]);
    const available = Number(parts[6] ?? parts[3]);
    const usedPercent = +((used / total) * 100).toFixed(2);

    const ram = {
      // default value from free is in MB; thus i have to convert to bytes first
      total: convertBytesToHumanReadableFileSize(total),
      used: convertBytesToHumanReadableFileSize(used),
      free: convertBytesToHumanReadableFileSize(free),
      available: convertBytesToHumanReadableFileSize(available),
      used_percent: usedPercent,
    };

    // DISK USAGE
    var output = await runShell("df --block-size=1 /");
    const dfOut = output.trim();

    var lines = dfOut
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return null;
    const cols = lines[1].split(/\s+/);
    const diskUsage = {
      filesystem: cols[0],
      total: convertBytesToHumanReadableFileSize(cols[1]),
      used: convertBytesToHumanReadableFileSize(cols[2]),
      available: convertBytesToHumanReadableFileSize(cols[3]),
      used_percent: cols[4],
      mount: cols[5] ?? "/",
    };

    // CPU Topology
    const cpuTopology = await getCpuTopology();

    // TOP PROCESSES
    const topProcesses = await getTopProcesses(20);

    // TOP FILES
    let topFiles = null;
    // await ioRedisClient.del(TOP_FILES_REDIS_KEY);
    const cached = await ioRedisClient.get(TOP_FILES_REDIS_KEY);
    if (cached) {
      topFiles = JSON.parse(cached);
    } else {
      // Trigger background computation, don't wait return empty for now
      computeTopDiskFiles(20)
        .then(async (rows) => {
          await ioRedisClient.set(
            TOP_FILES_REDIS_KEY,
            JSON.stringify(rows),
            "EX",
            TOP_FILES_TTL
          );
        })
        .catch((e) => console.error("top files compute failed:", e));

      topFiles = [];
    }

    // Sys Health Logger
    const csvPath = path.resolve(__dirname, "../logs/ram-history.csv");
    const tsSeries = await getSystemMonitorLog(csvPath, tsRange);

    const payload = {
      hostname,
      ram,
      disk: diskUsage,
      cpu: cpuTopology,
      top_processes: topProcesses,
      top_files: topFiles,
      timelog: tsSeries,
    };

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error("Analytics error:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function getSettingsOverview(req, res) {
  try {
    const user = req.user;
    let mfaIsActive = false;
    if (user.totp_secret) mfaIsActive = true;

    const data = {
      hasMfaConfig,
      mfaIsActive,
      hasEmailConfig,
    };

    return res.status(200).json({
      success: true,
      message: "Data returned successfully",
      data,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function generateMfaSecret(req, res) {
  try {
    const user = req.user;

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `Deployster (${process.env.DEPLOYSTER_VPS_PUBLIC_IP})`,
      issuer: "Deployster",
    });

    const otpAuthUrl = speakeasy.otpauthURL({
      secret: secret.base32,
      label: user.email,
      issuer: `Deployster (${process.env.DEPLOYSTER_VPS_PUBLIC_IP})`,
      encoding: "base32",
    });

    return res.status(200).json({
      success: true,
      message: "Data returned successfully",
      data: {
        secret: secret.base32,
        otpAuthUrl,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

async function completeMfaSetup(req, res) {
  try {
    const { error } = mfaSetupValidationSchema.validate(req.body);
    if (error) {
      res.status(400);
      return res.json({
        status: false,
        message: error.details[0].message,
      });
    }

    const user = req.user;
    const { secret_base32, label, totp } = req.body;

    if (verifyTwoFactorToken(totp, secret_base32)) {
      const encryptedSecret = await Users.methods.encryptMfaSecret(
        secret_base32
      );
      await pool.run(
        "UPDATE users SET totp_secret = ?, authenticator_label = ? WHERE id = ?",
        [encryptedSecret, label, user.id]
      );
      return res.status(200).json({
        success: true,
        message: "MFA setup successfully",
        data: {},
      });
    } else {
      return res.status(403).json({
        success: false,
        message: "Invalid Authorization token",
        data: {},
      });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", data: {} });
  }
}

module.exports = {
  createUser,
  loginUser,
  getUser,
  logoutUser,
  getAllProjects,
  getSingleProject,
  updateProjectDetails,
  getProjectDeploymentActivities,
  getActiveDeploymentLog,
  streamLogFile,
  spinUpOrKillServer,
  bashAccessVerification,
  getListOfProjectPipelineJson,
  addNewPipelineJsonRecord,
  editProjectPipelineJsonRecord,
  deleteProjectPipelineJsonRecord,
  rollbackToCommitSnapshot,
  redisOverviewData,
  createNewRedisInstance,
  redisInstanceAdmin,
  getPostgresClusters,
  setPostgresDatabasePass,
  getPostgresClusterAnalytics,
  disconnectIdlePgConnection,
  runPgDbQuery,
  getPgDatabaseQuickSummary,
  getPgTableQuickSummary,
  getSysMonitorAnalytics,
  getSettingsOverview,
  generateMfaSecret,
  completeMfaSetup,
};
