var express = require("express");
var router = express.Router();
const path = require("path");
const fs = require("fs");
const ADMIN_PATH = process.env.ADMIN_PATH || "app";
const PORT = process.env.PORT || 3259;

router.get(`/${ADMIN_PATH}`, (req, res) => {
  const VUE_BASE_API_URL = `http://127.0.0.1:${PORT}/api`;
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
  const protocol = process.env.PROTOCOL || "http";
  const baseURL = `${protocol}://${process.env.VPS_PUBLIC_IP}:${process.env.PORT}`;

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
