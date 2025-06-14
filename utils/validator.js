const Joi = require("joi");

const createUserValidationSchema = Joi.object({
  token: Joi.string().required(),
  username: Joi.string().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(4).required(),
});

const loginValidationSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const updateProjectValidationSchema = Joi.object({
  git_url: Joi.string().uri().required().allow(""),
  app_url: Joi.string().uri().required().allow(""),
  log_paths: Joi.array().required(),
});

const serverActionValidationSchema = Joi.object({
  project_id: Joi.string().uri().required().allow(""),
  action: Joi.string().valid("redeploy", "kill").required(),
});

const bashAccessValidationSchema = Joi.object({
  system_username: Joi.string().required(),
  deployster_password: Joi.string().required(),
});

module.exports = {
  createUserValidationSchema,
  loginValidationSchema,
  updateProjectValidationSchema,
  serverActionValidationSchema,
  bashAccessValidationSchema,
};
