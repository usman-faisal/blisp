-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

-- AlterTable
--
-- `code` becomes nullable because targeted invites carry no code. This is an
-- ALTER, not a drop-and-add: the existing codes are preserved. Verified with
-- `prisma migrate diff` before this file was applied, since a generated
-- DROP COLUMN/ADD COLUMN pair here would have destroyed every live invite.
ALTER TABLE "project_invites" ADD COLUMN     "invited_user_id" TEXT,
ADD COLUMN     "responded_at" TIMESTAMP(3),
ADD COLUMN     "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "code" DROP NOT NULL;

-- Backfill: an invite that was already redeemed is ACCEPTED, not PENDING.
--
-- The DEFAULT above would otherwise leave every spent code invite claiming to
-- be pending. `usedAt` stays the authority for the code flow, so this would not
-- cause a live bug — but a table full of rows contradicting themselves misleads
-- whoever reads it next. Lives in the migration rather than a script so it
-- cannot be skipped, following the owner backfill in
-- 20260731090036_add_project_collaboration.
UPDATE "project_invites"
SET "status" = 'ACCEPTED', "responded_at" = "used_at"
WHERE "used_at" IS NOT NULL;

-- Expired-but-unclaimed invites are left PENDING on purpose: expiry is derived
-- from `expires_at` at read time, and stamping a status here would freeze a
-- judgement that the query can make correctly for itself.

-- CreateIndex
CREATE INDEX "project_invites_invited_user_id_status_idx" ON "project_invites"("invited_user_id", "status");

-- CreateIndex
--
-- One invite row per person per project. Existing rows all have
-- invited_user_id = NULL and Postgres treats NULLs as distinct, so no existing
-- row conflicts and open code invites stay unconstrained.
CREATE UNIQUE INDEX "project_invites_project_id_invited_user_id_key" ON "project_invites"("project_id", "invited_user_id");

-- AddForeignKey
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
