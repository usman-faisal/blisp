import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { PipelineEventsService } from './pipeline-events.service';

@Global()
@Module({
  providers: [PipelineEventsService, PrismaService],
  exports: [PipelineEventsService],
})
export class PipelineEventsModule {}
