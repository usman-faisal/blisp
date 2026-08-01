import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_COMMENT_LENGTH } from './create-comment.dto';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Replacement comment text.',
    maxLength: MAX_COMMENT_LENGTH,
  })
  @IsString()
  // See CreateCommentDto: trim first, or a whitespace-only edit blanks the
  // comment while passing validation.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'A comment cannot be empty.' })
  @MaxLength(MAX_COMMENT_LENGTH)
  body: string;
}
