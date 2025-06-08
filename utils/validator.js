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

module.exports = {
  createUserValidationSchema,
  loginValidationSchema,
  updateProjectValidationSchema,
};
