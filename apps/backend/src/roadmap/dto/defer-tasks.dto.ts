import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class DeferTasksDto {
  /**
   * The exact ids shown in the confirmation preview.
   *
   * Explicit rather than recomputed server-side so what the user approved is
   * what is applied; a recomputation could drift if anything changed between
   * preview and confirm.
   */
  @ApiProperty({ description: 'Tasks to defer, as confirmed in the preview', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  taskIds!: string[];
}
