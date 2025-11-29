const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.DEPLOYSTER_SMTP_HOST,
  port: process.env.DEPLOYSTER_SMTP_PORT,
  secure: process.env.DEPLOYSTER_SMTP_PORT == 465,
  auth: {
    user: process.env.DEPLOYSTER_SMTP_USER,
    pass: process.env.DEPLOYSTER_SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Disable certificate validation
  },
});

module.exports = transporter;
