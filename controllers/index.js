const fs = require("fs").promises;
const path = require("path");
const moment = require("moment");
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
      projects.map(async (projectData) => ({
        ...projectData,
        name: convertFolderNameToDocumentTitle(
          Array.from(projectData.app_local_path.split("/")).pop()
        ),
        status: await isPortActive(projectData.tcp_port),
      }))
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
      Array.from(projectInView.app_local_path.split("/")).pop()
    ),
    status: projectInView.tcp_port
      ? await isPortActive(projectInView.tcp_port)
      : null,
    deployster_conf: checkDeploysterConf(projectInView.app_local_path),
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

    const { git_url, app_url, log_paths } = req.body;

    const [LOG_PATH_I, LOG_PATH_II, LOG_PATH_III] = log_paths;

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
  let projectInView;
  let currentDeployment;

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

    const deploymentActivityLogs = await pool.all(
      "SELECT actlog.*, dep.commit_hash, dep.log_output, u.email FROM activity_logs actlog INNER JOIN deployments dep ON dep.id = actlog.deployment_id INNER JOIN users u ON u.id = dep.user_id WHERE actlog.project_id = ? ORDER BY actlog.id DESC",
      [projectId]
    );

    try {
      currentDeployment = await getSingleRow(
        `SELECT * FROM deployments
          WHERE project_id = ?
            AND status = ?
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
    const { project_id, action } = req.body;

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
      projectInView.app_local_path,
      action
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
};
