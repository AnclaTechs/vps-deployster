var express = require("express");
const {
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
} = require("../controllers");
const { authenticateUser } = require("../middlewares");
var router = express.Router();

router.post("/create-user-account", createUser);
router.post("/login", loginUser);
router.post("/logout", authenticateUser, logoutUser);
router.get("/user", authenticateUser, getUser);
router.get("/projects", authenticateUser, getAllProjects);
router.get("/project/:projectId", authenticateUser, getSingleProject);
router.patch("/project/:projectId", authenticateUser, updateProjectDetails);

router.get(
  "/project/:projectId/deployment-activities",
  authenticateUser,
  getProjectDeploymentActivities
);

router.get(
  "/project/:projectId/active-deployment-log/:deploymentId",
  authenticateUser,
  getActiveDeploymentLog
);

router.get("/stream-log-file", authenticateUser, streamLogFile);

router.post("/server-action", authenticateUser, spinUpOrKillServer);

module.exports = router;
