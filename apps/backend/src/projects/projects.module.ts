import { Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DailyPlanModule } from 'src/daily_plan/daily-plan.module';

@Module({
  imports: [DailyPlanModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
