import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';
import { AUDIO_FIELD_NAME, MAX_AUDIO_BYTES } from './transcription.constants';
import { TranscribeAudioResponse, TranscriptionService } from './transcription.service';

@ApiTags('transcription')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('transcription')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  /**
   * Transcribes a recording and returns the text for the user to review.
   *
   * Deliberately does NOT create a brain dump: the user edits the transcript
   * first and submits it through the existing POST /brain-dumps. That keeps
   * "exactly once" submission under the user's control and means a bad
   * transcription never creates a project.
   *
   * memoryStorage keeps audio out of the filesystem entirely — nothing to
   * clean up, nothing retained once the request ends.
   */
  @Post('audio')
  @UseInterceptors(
    FileInterceptor(AUDIO_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe a voice recording into editable text' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [AUDIO_FIELD_NAME],
      properties: {
        [AUDIO_FIELD_NAME]: {
          type: 'string',
          format: 'binary',
          description: 'Audio recording (m4a, mp4, wav, mp3, webm, ogg, flac)',
        },
        language: {
          type: 'string',
          description: 'Optional ISO language hint, e.g. "en". Omit to auto-detect.',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Audio transcribed successfully.' })
  @ApiResponse({ status: 400, description: 'Missing, empty, or silent audio.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 413, description: 'Recording exceeds the size limit.' })
  @ApiResponse({ status: 415, description: 'Unsupported audio format.' })
  @ApiResponse({ status: 503, description: 'Transcription provider unavailable.' })
  async transcribeAudio(
    @CurrentUser() user: User,
    @UploadedFile() audio: Express.Multer.File,
    @Body() body: TranscribeAudioDto,
  ): Promise<TranscribeAudioResponse> {
    return this.transcriptionService.transcribeAudio(audio, user.id, body?.language);
  }
}
