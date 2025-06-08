var express = require("express");
const {
  createUser,
  loginUser,
  getUser,
  logoutUser,
  getAllProjects,
  getSingleProject,
  updateProjectDetails,
} = require("../controllers");
const { authenticateUser } = require("../middlewares");
var router = express.Router();

router.post("/create-user-account", createUser);
router.post("/login", loginUser);
router.post("/logout", authenticateUser, logoutUser);
router.get("/user", authenticateUser, getUser);
router.get("/get-projects", authenticateUser, getAllProjects);
router.get("/get-project/:projectId", authenticateUser, getSingleProject);
router.patch("/get-project/:projectId", authenticateUser, updateProjectDetails);

module.exports = router;
