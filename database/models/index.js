import { defineModel, Fields } from "@anclatechs/sql-buns-migrate";

export const Users = defineModel(
  "users",
  {
    id: { type: Fields.IntegerField, primaryKey: true, autoIncrement: true },
    username: { type: Fields.TextField },
    email: { type: Fields.TextField },
    password: { type: Fields.TextField },
    created_at: { type: Fields.DateTimeField, default: "CURRENT_TIMESTAMP" },
    updated_at: { type: Fields.DateTimeField, nullable: true },
  },
  {
    relations: {
      projects: { type: "hasMany", model: "projects", foreignKey: "user_id" },
      deployments: {
        type: "hasMany",
        model: "deployments",
        foreignKey: "user_id",
      },
    },
    meta: { tableName: "users" },
  }
);

export const Projects = defineModel(
  "projects",
  {
    id: { type: Fields.IntegerField, primaryKey: true, autoIncrement: true },
    user_id: { type: Fields.IntegerField },
    current_head: { type: Fields.TextField, nullable: true },
    app_local_path: { type: Fields.TextField, nullable: true },
    app_url: { type: Fields.TextField, nullable: true },
    repository_url: { type: Fields.TextField, nullable: true },
    tcp_port: { type: Fields.TextField, nullable: true },
    log_file_i_location: { type: Fields.TextField, nullable: true },
    log_file_ii_location: { type: Fields.TextField, nullable: true },
    log_file_iii_location: { type: Fields.TextField, nullable: true },
    /**
     * Pipeline JSON Rationale:
     * THE idea behind keeping a miniature of the parent object in the pipeline json is because it's optional. A project may not need a pipeline  but once activated it becomes
     * imperative to seprate concerns but also importantly to keep it fluid. Hence why I went for this instead of creating a model/table for each stage. A pipeline stage can be temporary/transeint
     * to allow each project stage have a benefit/create the perception of independence
     */
    pipeline_json: {
      type: Fields.TextField,
      nullable: true,
      helpText: `Stringified JSON array of pipeline stages, each containing: 
        { 
            stage_uuid: string, 
            stage_name: string, 
            git_branch: string, 
            environment_variables: array, 
            tcp_port: number?, 
            current_head: string?, 
            app_url: string?, 
            log_file_i_location: string?, 
            log_file_ii_location: string?, 
            log_file_iii_location: string?
        }`,
    },
  },
  {
    relations: {
      deployments: {
        type: "hasMany",
        model: "deployments",
        foreignKey: "project_id",
      },
      activity_logs: {
        type: "hasMany",
        model: "activity_logs",
        foreignKey: "project_id",
      },
    },
    meta: { tableName: "projects" },
  }
);

export const Deployments = defineModel(
  "deployments",
  {
    id: { type: Fields.IntegerField, primaryKey: true, autoIncrement: true },
    user_id: { type: Fields.IntegerField },
    project_id: { type: Fields.IntegerField },
    commit_hash: { type: Fields.TextField },
    action: {
      type: Fields.TextField,
      helpText: `choices: DEPLOY or ROLLBACK`,
    },
    status: {
      type: Fields.TextField,
      helpText: `choices: RUNNING, COMPLETED or FAILED`,
    },
    started_at: { type: Fields.DateTimeField, default: "CURRENT_TIMESTAMP" },
    finished_at: { type: Fields.DateTimeField, nullable: true },
    log_output: { type: Fields.TextField, nullable: true },
    artifact_path: { type: Fields.TextField, nullable: true },
    pipeline_stage_uuid: { type: Fields.TextField, nullable: true },
  },
  {
    relations: {
      activity_logs: {
        type: "hasMany",
        model: "activity_logs",
        foreignKey: "deployment_id",
      },
    },
    meta: { tableName: "deployments" },
  }
);

export const ActivityLogs = defineModel(
  "activity_logs",
  {
    id: { type: Fields.IntegerField, primaryKey: true, autoIncrement: true },
    project_id: { type: Fields.IntegerField },
    deployment_id: { type: Fields.IntegerField, nullable: true },
    action: {
      type: Fields.TextField,
      helpText: `choices: DEPLOY or ROLLBACK`,
    },
    message: { type: Fields.TextField },
    created_at: { type: Fields.DateTimeField, default: "CURRENT_TIMESTAMP" },
  },
  {
    meta: { tableName: "activity_logs" },
  }
);

export const ManagedRedisServer = defineModel(
  "managed_redis_server",
  {
    id: { type: Fields.IntegerField, primaryKey: true, autoIncrement: true },
    name: { type: Fields.TextField },
    port: { type: Fields.IntegerField },
    metadata: { type: Fields.TextField },
    created_at: { type: Fields.DateTimeField, default: "CURRENT_TIMESTAMP" },
  },
  {
    meta: { tableName: "managed_redis_server" },
  }
);

export const SqlbunsMigrations = defineModel(
  "_sqlbuns_migrations",
  {
    id: {
      type: Fields.IntegerField,
      nullable: true,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: Fields.CharField, maxLength: 255 },
    checksum: { type: Fields.CharField, maxLength: 64 },
    previous_checksum: {
      type: Fields.CharField,
      maxLength: 64,
      nullable: true,
    },
    direction: { type: Fields.CharField, maxLength: 10, default: "up" },
    applied_at: {
      type: Fields.DateTimeField,
      nullable: true,
      default: "CURRENT_TIMESTAMP",
    },
    rolled_back: { type: Fields.IntegerField, nullable: true, default: "0" },
    rolled_back_at: { type: Fields.DateTimeField, nullable: true },
  },
  {
    meta: { tableName: "_sqlbuns_migrations" },
  }
);
