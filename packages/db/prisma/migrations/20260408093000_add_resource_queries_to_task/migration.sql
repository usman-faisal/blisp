/*
  Warnings:

  - The values [PROGRESS_UPDATE] on the enum `Classification` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Classification_new" AS ENUM ('PROJECT', 'FEATURE', 'BUG', 'REFACTOR', 'RESEARCH_SPIKE');
ALTER TABLE "projects" ALTER COLUMN "classification" TYPE "Classification_new" USING ("classification"::text::"Classification_new");
ALTER TYPE "Classification" RENAME TO "Classification_old";
ALTER TYPE "Classification_new" RENAME TO "Classification";
DROP TYPE "Classification_old";
COMMIT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "resource_queries" TEXT[],
ADD COLUMN     "rollover_count" INTEGER NOT NULL DEFAULT 0;
