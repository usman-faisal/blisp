-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERIC', 'MEMBER_JOINED', 'TASK_ASSIGNED', 'TASK_COMMENTED', 'TASK_MENTIONED', 'TASK_COMPLETED', 'PROJECT_INVITE');

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "invite_id" UUID,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'GENERIC';

-- CreateIndex
CREATE INDEX "Notification_userId_read_at_idx" ON "Notification"("userId", "read_at");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "project_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
