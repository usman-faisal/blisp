import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@repo/db';

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, description: 'New task status' })
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
