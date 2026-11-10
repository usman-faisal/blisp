import { Module } from '@nestjs/common';
import { XaiTranscriptionProvider } from './providers/xai-transcription.provider';
import { TranscriptionController } from './transcription.controller';
import { TRANSCRIPTION_PROVIDER } from './transcription.provider';
import { TranscriptionService } from './transcription.service';

/**
 * Voice capture: audio in, editable text out.
 *
 * The concrete provider is bound in one place, so switching vendor means
 * editing this binding and adding a class under ./providers.
 */
@Module({
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    XaiTranscriptionProvider,
    {
      provide: TRANSCRIPTION_PROVIDER,
      useExisting: XaiTranscriptionProvider,
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
