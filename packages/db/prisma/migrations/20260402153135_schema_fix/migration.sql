/*
  Warnings:

  - The `status` column on the `projects` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INCUBATOR', 'ACTIVE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "BrainDumpStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- AlterEnum
ALTER TYPE "Classification" ADD VALUE 'PROGRESS_UPDATE';

-- AlterTable
ALTER TABLE "brain_dumps" ADD COLUMN     "status" "BrainDumpStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "status",
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'INCUBATOR';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "daily_plan_id" UUID,
ADD COLUMN     "plannedFor" DATE,
DROP COLUMN "status",
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'TODO';

-- DropEnum
DROP TYPE "Status";

-- CreateTable
CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_user_id_plan_date_key" ON "daily_plans"("user_id", "plan_date");

-- AddForeignKey
ALTER TABLE "brain_dumps" ADD CONSTRAINT "brain_dumps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_daily_plan_id_fkey" FOREIGN KEY ("daily_plan_id") REFERENCES "daily_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
