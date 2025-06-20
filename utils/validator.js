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
  project_id: Joi.number().required(),
  action: Joi.string().valid("redeploy", "kill").required(),
  stage_uuid: Joi.string().allow(""),
});

const bashAccessValidationSchema = Joi.object({
  system_username: Joi.string().required(),
  deployster_password: Joi.string().required(),
});

const pipelineEnvironmentVariableFormat = Joi.object().keys({
  key: Joi.string().required(),
  value: Joi.string().required(),
});

const pipelineFormat = Joi.object().keys({
  stage_name: Joi.string().required(),
  git_branch: Joi.string().required(),
  environment_variables: Joi.array()
    .items(pipelineEnvironmentVariableFormat)
    .min(0),
});

const pipelineJsonValidationSchema = Joi.object({
  project_id: Joi.number().required(),
  data: Joi.array().items(pipelineFormat).min(1),
});

const updateExistingPipelineJsonValidationSchema = Joi.object({
  project_id: Joi.number().required(),
  stage_uuid: Joi.string().required(),
  data: pipelineFormat,
});

const deleteExistingPipelineJsonValidationSchema = Joi.object({
  project_id: Joi.number().required(),
  stage_uuid: Joi.string().required(),
});

module.exports = {
  createUserValidationSchema,
  loginValidationSchema,
  updateProjectValidationSchema,
  serverActionValidationSchema,
  bashAccessValidationSchema,
  pipelineJsonValidationSchema,
  updateExistingPipelineJsonValidationSchema,
  deleteExistingPipelineJsonValidationSchema,
};
