/*
  Warnings:

  - You are about to drop the column `user_id` on the `activity_logs` table. All the data in the column will be lost.
  - Added the required column `project_id` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Made the column `message` on table `activity_logs` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_activity_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "project_id" INTEGER NOT NULL,
    "deployment_id" INTEGER,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activity_logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activity_logs" ("action", "created_at", "deployment_id", "id", "message") SELECT "action", "created_at", "deployment_id", "id", "message" FROM "activity_logs";
DROP TABLE "activity_logs";
ALTER TABLE "new_activity_logs" RENAME TO "activity_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
