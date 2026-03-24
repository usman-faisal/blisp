import { Module } from '@nestjs/common';
import { BrainDumpsService } from './brain-dumps.service';
import { BrainDumpsController } from './brain-dumps.controller';

@Module({
  controllers: [BrainDumpsController],
  providers: [BrainDumpsService],
})
export class BrainDumpsModule {}
