-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "task_id" UUID;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "is_immediate_next_step" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
