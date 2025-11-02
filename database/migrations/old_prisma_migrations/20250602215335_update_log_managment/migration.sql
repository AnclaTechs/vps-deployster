/*
  Warnings:

  - You are about to drop the `ActivityLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `userId` on the `deployments` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `deployments` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ActivityLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "projects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "current_head" TEXT,
    "app_local_path" TEXT,
    "app_url" TEXT,
    "repository_url" TEXT,
    "tcp_port" TEXT,
    "log_file_i_location" TEXT,
    "log_file_ii_location" TEXT,
    "log_file_iii_location" TEXT,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "deployment_id" INTEGER,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activity_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_deployments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "commit_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "log_output" TEXT,
    "artifact_path" TEXT,
    CONSTRAINT "deployments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_deployments" ("action", "artifact_path", "commit_hash", "finished_at", "id", "log_output", "started_at", "status") SELECT "action", "artifact_path", "commit_hash", "finished_at", "id", "log_output", "started_at", "status" FROM "deployments";
DROP TABLE "deployments";
ALTER TABLE "new_deployments" RENAME TO "deployments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
