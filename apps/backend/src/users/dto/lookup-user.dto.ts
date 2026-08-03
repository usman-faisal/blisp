import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** Addresses and search terms arrive pasted, often with surrounding space. */
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Query for the exact-match recipient lookup.
 *
 * Email is the only handle available: User has no username, and `name` is not
 * unique. @IsEmail also does useful work beyond validation — it rejects a bare
 * prefix like "mustafa" with a 400 before it reaches the database, so this route
 * cannot be used to probe for accounts by partial string.
 */
export class LookupUserDto {
  @ApiPropertyOptional({
    description: 'Exact email address of the person to look up',
    example: 'teammate@example.com',
  })
  @Transform(trim)
  @IsEmail({}, { message: 'Provide a valid email address.' })
  email: string;
}

/**
 * Query for the browsable list the invite picker renders.
 *
 * Paginated and capped deliberately: this returns other people's names and
 * email addresses, so an uncapped `limit` would let one request dump the whole
 * user table.
 */
export class ListUsersDto {
  @ApiPropertyOptional({ description: 'Match against name or email', example: 'mus' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Hide people who already belong to this project, so the picker cannot ' +
      'offer someone the invite would only reject.',
  })
  @IsOptional()
  @IsUUID()
  excludeProjectId?: string;
}
