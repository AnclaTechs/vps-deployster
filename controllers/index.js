const fs = require("fs").promises;
const path = require("path");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const JWTR = require("jwt-redis").default;
const pool = require("../database/index");
const { RecordDoesNotExist } = require("../database/error");
const { getSingleRow } = require("../database/functions");
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
} = require("../utils/validator");
const redisClient = require("../redis");
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
} = require("../utils/functools");
const { DEPLOYMENT_STATUS } = require("../utils/constants");
const jwtr = new JWTR(redisClient);

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
          [username, email, hashedPassword, timestamp, timestamp]
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

    const { username, password } = req.body;
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
    const token = await jwtr.sign(
      { userId: user.id, email: user.email, username: user.username },
      process.env.DEPLOYSTER_JSON_WEB_TOKEN_KEY
    );

    return res.json({
      status: true,
      message: "Login successful",
      data: {
        token: token,
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
      return res
        .status(403)
        .json({ status: false, message: "Error getting deployment lock key" });
    }

    await redisClient.set(`job:${job_id}:status`, "queued");
    await redisClient.del(`job:${job_id}:logs`);

    try {
      await redisClient.set(`job:${job_id}:status`, "running");

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
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (error) {
      var errorOutput = `[ERROR] Error recording deployment log: ${error}`;
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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
          await redisClient.append(`job:${job_id}:logs`, errorOutput);
          await redisClient.set(`job:${job_id}:status`, "failed");
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
        await redisClient.append(`job:${job_id}:logs`, newLogMessage);
        await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
      } else {
        var errorOutput = `[ERROR] Project has no active pipeline record\n`;
        await redisClient.append(`job:${job_id}:logs`, errorOutput);
        await redisClient.set(`job:${job_id}:status`, "failed");
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
    await redisClient.append(`job:${job_id}:logs`, newLogMessage);
    await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

    try {
      specificDeploymentInView = await getSingleRow(
        `SELECT * FROM deployments WHERE project_id = ? AND commit_hash = ? AND status = ? AND action = ? ${PIPELINE_SQL_DEPLOYMENT_FILTER}`,
        [projectInView.id, commit_hash, "COMPLETED", "DEPLOY"]
      );

      var newLogMessage = `\n[INFO] Deployment record - ${specificDeploymentInView.id} obtained\n`;
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] Error getting deployment record: ${err}\n`;
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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

      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);

      // REDEPLOY
      serverActionHandler(
        projectInView.id,
        "redeploy",
        pipelineStageInView?.stage_uuid
      );

      var newLogMessage = `\n[INFO] Server restarted successfully\n`;
      await redisClient.append(`job:${job_id}:logs`, newLogMessage);
      await addLogToDeploymentRecord(deploymentRecord.id, newLogMessage);
    } catch (err) {
      var errorOutput = `[ERROR] ${err}\n`;
      await redisClient.append(`job:${job_id}:logs`, errorOutput);
      await redisClient.set(`job:${job_id}:status`, "failed");
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

    await redisClient.set(`job:${job_id}:status`, "complete");

    // Clear the logs from Redis upon completion
    await redisClient.del(`job:${job_id}:logs`);

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
};
