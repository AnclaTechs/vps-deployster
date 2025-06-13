const JWTR = require("jwt-redis").default;
const redisClient = require("../redis");
const jwtr = new JWTR(redisClient);
const { getSingleRow } = require("../database/functions");

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
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = await verifyToken(token);
    const user = await findUserByDecodedToken(decoded);

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

module.exports = {
  verifyToken,
  findUserByDecodedToken,
  authenticateUser,
  assertIsUser,
};
