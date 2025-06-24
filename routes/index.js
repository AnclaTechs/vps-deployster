var express = require("express");
var router = express.Router();
const path = require("path");
const fs = require("fs");
const { isIPAddress } = require("../utils/functools");
const DEPLOYSTER_ADMIN_PATH = process.env.DEPLOYSTER_ADMIN_PATH || "app";
const DEPLOYSTER_PORT = process.env.DEPLOYSTER_PORT || 3259;
const DEPLOYSTER_PROTOCOL = process.env.DEPLOYSTER_PROTOCOL || "http";
const DEPLOYSTER_VPS_PUBLIC_IP =
  process.env.DEPLOYSTER_VPS_PUBLIC_IP || "127.0.0.1";

router.get(`/${DEPLOYSTER_ADMIN_PATH}`, (req, res) => {
  const VUE_BASE_API_URL = `${DEPLOYSTER_PROTOCOL}://${DEPLOYSTER_VPS_PUBLIC_IP}${
    isIPAddress(DEPLOYSTER_VPS_PUBLIC_IP) && DEPLOYSTER_PORT
      ? ":" + DEPLOYSTER_PORT
      : ""
  }/api`;
  res.render("index", {
    VUE_BASE_API_URL,
  });
});

router.get("/vue/{*any}", (req, res) => {
  const filename = req.params.any.join("/");
  const filePath = path.join(
    __dirname,
    "../template/ejs-views/vue-app",
    filename
  );

  const referer = req.headers.referer || req.headers.origin;
  const baseURL = `${DEPLOYSTER_PROTOCOL}://${DEPLOYSTER_VPS_PUBLIC_IP}${
    isIPAddress(DEPLOYSTER_VPS_PUBLIC_IP) && DEPLOYSTER_PORT
      ? ":" + DEPLOYSTER_PORT
      : ""
  }`;

  if (!referer || !referer.startsWith(baseURL)) {
    return res.status(403).send("Access Denied");
  }

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Vue file not found");
  }
});

module.exports = router;
