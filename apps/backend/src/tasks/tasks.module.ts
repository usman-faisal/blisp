import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from 'src/common/services/prisma.service';
import { QUEUES } from 'src/common/lib/constants';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUES.INCUBATOR,
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, PrismaService],
})
export class TasksModule {}
