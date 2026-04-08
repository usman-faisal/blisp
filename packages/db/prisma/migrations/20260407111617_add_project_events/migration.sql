/*
  Warnings:

  - You are about to drop the column `is_immediate_next_step` on the `tasks` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('RESEARCH_STARTED', 'RESEARCH_COMPLETED', 'PLAN_STARTED', 'PLAN_COMPLETED', 'DAILY_PLAN_STARTED', 'DAILY_PLAN_COMPLETED', 'RESOURCE_FETCH_STARTED', 'RESOURCE_FETCH_COMPLETED');

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "is_immediate_next_step";

-- CreateTable
CREATE TABLE "project_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_events_project_id_idx" ON "project_events"("project_id");

-- AddForeignKey
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
