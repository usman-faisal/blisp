import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignTaskDto {
  @ApiPropertyOptional({
    description:
      'Clerk user id of the member to assign. Omit or pass null to unassign the task.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}
