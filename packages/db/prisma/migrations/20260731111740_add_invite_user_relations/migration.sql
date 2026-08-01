-- AddForeignKey
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
