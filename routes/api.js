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
  bashAccessVerification,
  addNewPipelineJsonRecord,
  editProjectPipelineJsonRecord,
  deleteProjectPipelineJsonRecord,
  getListOfProjectPipelineJson,
  rollbackToCommitSnapshot,
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

router.post("/verify-bash-access", authenticateUser, bashAccessVerification);

router.get(
  "/project/:projectId/pipe-line-json",
  authenticateUser,
  getListOfProjectPipelineJson
);

router.post(
  "/project/add-pipeline-json",
  authenticateUser,
  addNewPipelineJsonRecord
);

router.post(
  "/project/update-pipeline-json",
  authenticateUser,
  editProjectPipelineJsonRecord
); // I CHANGED THIS FROM PATH TO POST

router.post(
  "/project/delete-pipeline-json",
  authenticateUser,
  deleteProjectPipelineJsonRecord
); // I CHANGED THIS FROM DELETE TO POST

router.post(
  "/project/rollback-to-commit",
  authenticateUser,
  rollbackToCommitSnapshot
);

module.exports = router;
