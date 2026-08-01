import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Bound the body so a runaway client cannot write unbounded text. */
export const MAX_COMMENT_LENGTH = 2000;

export class CreateCommentDto {
  @ApiProperty({
    description:
      'Comment text. Mention a project member with @their name — they are notified.',
    maxLength: MAX_COMMENT_LENGTH,
    example: '@test user could you take a look at this?',
  })
  @IsString()
  // Trim before validating: IsNotEmpty only rejects '', so a whitespace-only
  // body would otherwise be stored as a blank comment.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'A comment cannot be empty.' })
  @MaxLength(MAX_COMMENT_LENGTH)
  body: string;
}
