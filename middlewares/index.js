const JWTR = require("jwt-redis").default;
const { getSingleRow } = require("@anclatechs/sql-buns");
const { redisClient } = require("../redis");
const {
  getPostgresCredentials,
  listPostgresClusters,
} = require("../utils/functools");
const signals = require("../signals");
const jwtr = new JWTR(redisClient);

async function verifyToken(token) {
  if (!token) throw new Error("No token provided");

  const decoded = await jwtr.verify(
    token,
    process.env.DEPLOYSTER_JSON_WEB_TOKEN_KEY
  );
  return decoded;
}

async function findUserByDecodedToken(decoded) {
  if (!decoded?.username) throw new Error("Invalid token payload");

  const identifier = String(decoded.username).toLowerCase();
  const isEmail = identifier.includes("@");

  const user = await getSingleRow(
    `SELECT * FROM users WHERE ${isEmail ? "email" : "username"} = ?`,
    [identifier]
  );

  if (!user) throw new Error("User not found");

  return user;
}

async function authenticateUser(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = await verifyToken(token);
    const user = await findUserByDecodedToken(decoded);
    const now = Date.now();

    if (user.last_activity) {
      const last = new Date(user.last_activity).getTime();
      const inactiveTime = now - last;

      if (inactiveTime > 15 * 60 * 1000) {
        // 15 minutes of inactivity
        const verified = await jwtr.decode(
          token,
          process.env.JSON_WEB_TOKE_KEY
        );
        await jwtr.destroy(verified.jti);
        return res
          .status(401)
          .json({ message: "Session expired due to inactivity" });
      }
    }

    // pass to signals
    signals.emit("updateUserLastActivityTime", {
      userId: user.id,
      timestamp: new Date(now).toISOString(),
    });

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res.status(401).json({
      status: false,
      message: error.message.includes("User not found")
        ? "User not found"
        : "Unauthorized: Invalid token",
    });
  }
}

function assertIsUser(req, res, next) {
  if (req.user.status == "ACTIVE") {
    next();
  } else {
    return res.status(403).json({
      status: false,
      message: "Forbidden: You do not have access to this resource",
    });
  }
}


async function pgDBValidator(req, res, next) {
  try {
    const clusterParam = req.params?.cluster;
    if (!clusterParam || typeof clusterParam !== "string") {
      return res.status(400).json({
        status: false,
        message: "Invalid cluster parameter",
        data: {},
      });
    }

    const [version, portStr] = clusterParam.split("-");
    if (!version || !portStr || isNaN(Number(portStr))) {
      return res.status(400).json({
        status: false,
        message: 'Invalid cluster format (e.g., "11-5432")',
        data: {},
      });
    }
    const clusterPort = Number(portStr);
    if (clusterPort < 1024 || clusterPort > 65535) {
      return res.status(400).json({
        status: false,
        message: "Invalid port range (1024-65535)",
        data: {},
      });
    }

    const pgVersions = await listPostgresClusters();
    if (!pgVersions.length) {
      return res.status(404).json({
        status: false,
        message: "No Postgres clusters available",
        data: {},
        dbVisualiserAuthRequired: false,
      });
    }

    const clusterDataRequest = pgVersions.find(
      (cluster) => cluster.version == version && cluster.port == clusterPort
    );
    if (!clusterDataRequest) {
      return res.status(403).json({
        status: false,
        message: `Cluster v${version} - port ${clusterPort} not found on machine`,
        data: {},
        dbVisualiserAuthRequired: true,
      });
    }

    const pgCredentials = await getPostgresCredentials(clusterPort);
    if (!pgCredentials) {
      return res.status(403).json({
        status: false,
        message: "Cluster authentication required",
        data: {},
        dbVisualiserAuthRequired: true,
      });
    }

    req.pgData = {
      version,
      clusterPort,
      pgCredentials,
    };

    next();
  } catch (error) {
    console.error("PG Validator error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error during validation",
      data: {},
    });
  }
}

module.exports = {
  verifyToken,
  findUserByDecodedToken,
  authenticateUser,
  assertIsUser,
  pgDBValidator,
};
