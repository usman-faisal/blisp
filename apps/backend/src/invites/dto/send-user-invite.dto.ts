import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * Body for a targeted invite. Identify the recipient by **either** id or email.
 *
 * Both are supported because the two are reached differently in the UI. Nobody
 * types a user id, so the picker searches with `GET /user?search=` and then sends
 * the `id` it already holds — one less lookup, and immune to a rename or an email
 * change between search and send. But an invite typed straight into an email
 * field should not require the client to resolve it first, so `email` is accepted
 * too and resolved server-side.
 *
 * `userId` wins when both are given: an id is exact, an email is a lookup.
 */
export class SendUserInviteDto {
  @ApiPropertyOptional({
    description: 'Clerk user id of the person to invite. Takes precedence over email.',
    example: 'user_3HDjdgr8XS6GzQ7bxYEZrSSXZR4',
  })
  // Not a UUID — Clerk ids look like `user_3HDj…`.
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Email of the person to invite. Used when userId is absent.',
    example: 'teammate@example.com',
  })
  // Required only when no userId was supplied, so one of the two must be present.
  @ValidateIf((dto: SendUserInviteDto) => !dto.userId)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Provide a valid email address, or a userId.' })
  email?: string;
}
