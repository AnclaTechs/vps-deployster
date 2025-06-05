const JWTR = require("jwt-redis").default;
const redisClient = require("../redis");
const jwtr = new JWTR(redisClient);
const { getSingleRow } = require("../database/functions");

exports.authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  try {
    const decoded = await jwtr.verify(
      token,
      process.env.DEPLOYSTER_JSON_WEB_TOKEN_KEY
    );
    try {
      let user;
      if (decoded?.username.includes("@")) {
        user = await getSingleRow("SELECT * FROM users WHERE email = ?", [
          String(decoded?.username).toLocaleLowerCase(),
        ]);
      } else {
        user = await getSingleRow("SELECT * FROM users WHERE username = ?", [
          decoded?.username,
        ]);
      }
      req.user = user;
      next();
    } catch (error) {
      console.log({ error });
      return res
        .status(500)
        .json({ status: false, message: "Error authenticating user" });
    }
  } catch (error) {
    return res
      .status(401)
      .json({ status: false, message: "Unauthorized: Invalid token" });
  }
};

exports.assertIsUser = (req, res, next) => {
  if (req.user.status == "ACTIVE") {
    next();
  } else {
    return res.status(403).json({
      status: false,
      message: "Forbidden: You do not have access to this resource",
    });
  }
};
