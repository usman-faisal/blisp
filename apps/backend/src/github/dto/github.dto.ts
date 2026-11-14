import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LinkRepositoryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @ApiProperty({
    example: 'usman-faisal/blisp',
    description: 'Repository as "owner/name" or a full GitHub URL.',
  })
  repository!: string;

  /**
   * Optional: public repositories need no token at all, which is the common
   * case and avoids asking for a credential that can then be mishandled.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    description:
      'Personal access token with read access. Only required for private repositories. Never returned by any endpoint.',
  })
  token?: string;
}

export class AddEvidenceDto {
  @IsString()
  @MaxLength(500)
  @ApiProperty({
    example: 'https://github.com/usman-faisal/blisp/commit/a3f91c2',
    description: 'A github.com link to a commit, pull request or issue.',
  })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ description: 'Optional label. Defaults to the URL path.' })
  title?: string;
}
