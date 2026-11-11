import { ApiProperty } from '@nestjs/swagger';
import { TaskEffort, TaskPriority } from '@repo/db';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ScopeItemDto {
  @ApiProperty({ description: 'What to build', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ enum: ['MUST_HAVE', 'SHOULD_HAVE', 'LATER'] })
  @IsEnum(['MUST_HAVE', 'SHOULD_HAVE', 'LATER'])
  priority!: TaskPriority;

  @ApiProperty({ enum: ['SMALL', 'MEDIUM', 'LARGE'] })
  @IsEnum(['SMALL', 'MEDIUM', 'LARGE'])
  effort!: TaskEffort;

  /** Provenance only — the user may have edited an item that came from the report. */
  @ApiProperty({ description: 'True when this item originated in the approved report', required: false })
  @IsOptional()
  @IsBoolean()
  fromReport?: boolean;
}

export class GenerateRoadmapDto {
  /**
   * The scope the user confirmed, after any edits.
   *
   * Sent in full rather than referencing the report, so the roadmap is built
   * from what the user approved on screen — not from what the report happens to
   * say at the moment the request arrives.
   */
  @ApiProperty({ type: [ScopeItemDto], description: 'Confirmed scope, in any order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ScopeItemDto)
  scope!: ScopeItemDto[];
}
