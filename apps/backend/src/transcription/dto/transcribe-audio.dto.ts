import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class TranscribeAudioDto {
  /**
   * Passed through to the provider, so it is pattern-constrained rather than
   * free text — this value ends up in an outbound multipart field.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/, {
    message: 'language must be a language code such as "en" or "en-GB"',
  })
  @ApiPropertyOptional({
    type: String,
    example: 'en',
    description: 'Optional language hint. Omit to let the provider auto-detect.',
  })
  language?: string;
}
