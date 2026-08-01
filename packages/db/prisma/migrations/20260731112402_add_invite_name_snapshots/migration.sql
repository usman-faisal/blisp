-- Name snapshots so an invite row is readable without joining to "User".
--
-- created_by_name is NOT NULL, but the table already holds rows, so this runs in
-- three steps: add nullable, backfill from the current user names, then enforce
-- the constraint. Adding it NOT NULL directly would fail on existing data.

-- AlterTable
ALTER TABLE "project_invites" ADD COLUMN "created_by_name" TEXT;
ALTER TABLE "project_invites" ADD COLUMN "used_by_name" TEXT;

-- Backfill from the related users.
UPDATE "project_invites" i
SET "created_by_name" = u."name"
FROM "User" u
WHERE u."id" = i."created_by";

UPDATE "project_invites" i
SET "used_by_name" = u."name"
FROM "User" u
WHERE u."id" = i."used_by";

-- Any row whose creator has since been deleted would still be NULL. The FK is
-- ON DELETE CASCADE so this cannot happen, but guard anyway rather than let the
-- NOT NULL below fail on a surprise.
UPDATE "project_invites"
SET "created_by_name" = '(unknown)'
WHERE "created_by_name" IS NULL;

-- Now enforce the constraint.
ALTER TABLE "project_invites" ALTER COLUMN "created_by_name" SET NOT NULL;
