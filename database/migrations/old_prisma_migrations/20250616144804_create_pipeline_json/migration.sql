-- AlterTable
ALTER TABLE "deployments" ADD COLUMN "pipeline_stage_uuid" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "pipeline_json" TEXT;
