-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('COMMIT', 'PULL_REQUEST', 'ISSUE', 'MANUAL');

-- CreateEnum
CREATE TYPE "VerificationVerdict" AS ENUM ('VERIFIED', 'UNVERIFIED', 'SELF_REPORTED', 'DISPUTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "github_login" VARCHAR(100);

-- CreateTable
CREATE TABLE "project_repositories" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "owner" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "github_id" BIGINT NOT NULL,
    "default_branch" VARCHAR(100) NOT NULL DEFAULT 'main',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "access_token" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "linked_by_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_evidence" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author_login" VARCHAR(100),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "match_reason" TEXT NOT NULL,
    "repository_id" UUID,
    "added_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_verifications" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "verdict" "VerificationVerdict" NOT NULL,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_repositories_project_id_idx" ON "project_repositories"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_repositories_project_id_github_id_key" ON "project_repositories"("project_id", "github_id");

-- CreateIndex
CREATE INDEX "task_evidence_task_id_idx" ON "task_evidence"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_evidence_task_id_source_external_id_key" ON "task_evidence"("task_id", "source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_verifications_task_id_key" ON "task_verifications"("task_id");

-- CreateIndex
CREATE INDEX "task_verifications_verdict_idx" ON "task_verifications"("verdict");

-- AddForeignKey
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "project_repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_verifications" ADD CONSTRAINT "task_verifications_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
