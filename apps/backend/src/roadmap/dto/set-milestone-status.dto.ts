import { ApiProperty } from '@nestjs/swagger';
import { MilestoneStatus } from '@repo/db';
import { IsEnum } from 'class-validator';

export class SetMilestoneStatusDto {
  @ApiProperty({ enum: ['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] })
  @IsEnum(['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  status!: MilestoneStatus;
}
