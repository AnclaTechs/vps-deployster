const DEPLOYMENT_STATUS = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

const DEPLOYMENT_ACTION_TYPE = {
  DEPLOY: "DEPLOY",
  ROLLBACK: "ROLLBACK",
};

const PASSWORD_TTL = 10 * 60;
const PG_PASSWORD_KEY = "PG_PASSWORD";
const PG_USERNAME_KEY = "PG_USERNAME";
const PG_CLUSTER = "PG_CLUSTER_VERSION";

const hasMfaConfig = Boolean(
  process.env.DEPLOYSTER_USE_MFA &&
    `${process.env.DEPLOYSTER_USE_MFA}`.toLowerCase() == "true"
);

const hasEmailConfig = Boolean(
  process.env.DEPLOYSTER_SMTP_HOST &&
    process.env.DEPLOYSTER_SMTP_PORT &&
    process.env.DEPLOYSTER_SMTP_USER &&
    process.env.DEPLOYSTER_SMTP_PASS
);

module.exports = {
  DEPLOYMENT_STATUS,
  DEPLOYMENT_ACTION_TYPE,
  PASSWORD_TTL,
  PG_PASSWORD_KEY,
  PG_USERNAME_KEY,
  PG_CLUSTER,
  hasMfaConfig,
  hasEmailConfig,
};
