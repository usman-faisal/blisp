-- CreateEnum
CREATE TYPE "TaskEffort" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('MUST_HAVE', 'SHOULD_HAVE', 'LATER');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "TaskStatus" ADD VALUE 'DEFERRED';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "deadline" DATE,
ADD COLUMN     "hours_per_day" DOUBLE PRECISION,
ADD COLUMN     "roadmap_planned_at" TIMESTAMP(3),
ADD COLUMN     "skill_level" "SkillLevel",
ADD COLUMN     "working_days" INTEGER[];

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "acceptance_criteria" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "effort" "TaskEffort",
ADD COLUMN     "milestone_id" UUID,
ADD COLUMN     "priority" "TaskPriority";

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "target_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_project_id_status_idx" ON "milestones"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_project_id_position_key" ON "milestones"("project_id", "position");

-- CreateIndex
CREATE INDEX "task_dependencies_prerequisite_id_idx" ON "task_dependencies"("prerequisite_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_prerequisite_id_key" ON "task_dependencies"("task_id", "prerequisite_id");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- CreateIndex
CREATE INDEX "tasks_completed_at_idx" ON "tasks"("completed_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
