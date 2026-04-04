import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateBrainDumpDto {
  @IsString({ message: 'Prompt must be a string' })
  @IsNotEmpty({ message: 'Prompt is required' })
  @MinLength(2, { message: 'Prompt must be at least 2 characters long' })
  @ApiProperty({ type: String, required: true, example: 'John Doe', description: 'User full name' })
  prompt: string;
}
