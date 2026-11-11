import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateRoadmapSettingsDto {
  @ApiPropertyOptional({ description: 'Target completion date (ISO). Null clears it.', example: '2026-11-20' })
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  /** Capped at 16: beyond that the plan is not one a person can sustain. */
  @ApiPropertyOptional({ description: 'Hours expected on a working day', minimum: 0.5, maximum: 16 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(16)
  hoursPerDay?: number | null;

  @ApiPropertyOptional({ description: 'ISO weekdays worked, 1 = Monday .. 7 = Sunday', example: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays?: number[];

  @ApiPropertyOptional({ enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] })
  @IsOptional()
  @IsEnum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
}
