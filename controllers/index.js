const moment = require("moment");
const bcrypt = require("bcrypt");
const JWTR = require("jwt-redis").default;
const pool = require("../database/index");
const { RecordDoesNotExist } = require("../database/error");
const { getSingleRow } = require("../database/functions");
const {
  createUserValidationSchema,
  loginValidationSchema,
} = require("../utils/validator");
const redisClient = require("../redis");
const { isPortActive } = require("../utils/functools");
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

        const timestamp = moment().format("yyyy-MM-dd HH:mm:ss");
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
        SELECT prjts.*, dep.finished_at
        FROM projects prjts
        INNER JOIN (
          SELECT project_id, MAX(finished_at) AS latest_finished_at
          FROM deployments
          GROUP BY project_id
        ) latest_dep
          ON latest_dep.project_id = prjts.id
        INNER JOIN deployments dep
          ON dep.project_id = latest_dep.project_id AND dep.finished_at = latest_dep.latest_finished_at
        WHERE prjts.user_id = ?
        ORDER BY dep.finished_at DESC
      `,
      [user.id]
    );

    projects = await Promise.all(
      projects.map(async (projectData) => ({
        ...projectData,
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

module.exports = {
  createUser,
  loginUser,
  getUser,
  logoutUser,
  getAllProjects,
};
