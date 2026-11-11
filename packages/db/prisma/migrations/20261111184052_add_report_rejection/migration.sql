-- AlterEnum
ALTER TYPE "ResearchReportStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "research_reports" ADD COLUMN     "rejection_reason" TEXT;
