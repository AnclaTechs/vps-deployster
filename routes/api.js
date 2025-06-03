var express = require("express");
const {
  createUser,
  loginUser,
  getUser,
  logoutUser,
  getAllProjects,
} = require("../controllers");
const { authenticateUser } = require("../middlewares");
var router = express.Router();

router.post("/create-user-account", createUser);
router.post("/login", loginUser);
router.post("/logout", authenticateUser, logoutUser);
router.get("/user", authenticateUser, getUser);
router.get("/get-projects", authenticateUser, getAllProjects);

module.exports = router;
