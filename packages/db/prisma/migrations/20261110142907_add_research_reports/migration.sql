-- CreateEnum
CREATE TYPE "ResearchReportStatus" AS ENUM ('PENDING', 'DRAFT', 'APPROVED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PipelineStage" ADD VALUE 'DISCOVERY_REPORT_STARTED';
ALTER TYPE "PipelineStage" ADD VALUE 'DISCOVERY_REPORT_COMPLETED';
ALTER TYPE "PipelineStage" ADD VALUE 'DISCOVERY_REPORT_FAILED';

-- CreateTable
CREATE TABLE "research_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ResearchReportStatus" NOT NULL DEFAULT 'PENDING',
    "sections" JSONB,
    "sources" JSONB,
    "researched_at" TIMESTAMP(3),
    "model" VARCHAR(100),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_reports_project_id_status_idx" ON "research_reports"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_reports_project_id_version_key" ON "research_reports"("project_id", "version");

-- AddForeignKey
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
