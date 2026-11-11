import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectReportDto {
  /**
   * Optional: a user may simply disagree without explaining.
   *
   * Capped because this string reaches a prompt — an unbounded reason would be
   * an injection surface and could crowd out the rest of the instructions.
   */
  @ApiPropertyOptional({
    description:
      'Why this version was rejected. Fed into the next generation as stated feedback, so the ' +
      'next version addresses it.',
    maxLength: 1000,
    example: 'The citations do not back the weaknesses, and it ignored offline support.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
