/*
  Warnings:

  - Added the required column `project_id` to the `deployments` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_deployments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "commit_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    "log_output" TEXT,
    "artifact_path" TEXT,
    CONSTRAINT "deployments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deployments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_deployments" ("action", "artifact_path", "commit_hash", "finished_at", "id", "log_output", "started_at", "status", "user_id") SELECT "action", "artifact_path", "commit_hash", "finished_at", "id", "log_output", "started_at", "status", "user_id" FROM "deployments";
DROP TABLE "deployments";
ALTER TABLE "new_deployments" RENAME TO "deployments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
