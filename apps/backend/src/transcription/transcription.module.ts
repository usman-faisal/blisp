import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqTranscriptionProvider } from './providers/groq-transcription.provider';
import { XaiTranscriptionProvider } from './providers/xai-transcription.provider';
import { TranscriptionController } from './transcription.controller';
import { TRANSCRIPTION_PROVIDER, TranscriptionProvider } from './transcription.provider';
import { TranscriptionService } from './transcription.service';

/**
 * Voice capture: audio in, editable text out.
 *
 * The concrete provider is chosen here and nowhere else. Both implementations
 * are constructed — they are cheap, and neither contacts its API until asked —
 * but only one is bound to TRANSCRIPTION_PROVIDER.
 *
 * Groq (free tier, Whisper) is the default. xAI/Grok is kept because it is
 * written and tested, but it bills per audio hour with no free tier, so it is
 * opt-in via STT_PROVIDER=xai rather than something you can enable by accident.
 */
@Module({
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    GroqTranscriptionProvider,
    XaiTranscriptionProvider,
    {
      provide: TRANSCRIPTION_PROVIDER,
      inject: [ConfigService, GroqTranscriptionProvider, XaiTranscriptionProvider],
      useFactory: (
        configService: ConfigService,
        groq: GroqTranscriptionProvider,
        xai: XaiTranscriptionProvider,
      ): TranscriptionProvider => {
        const logger = new Logger('TranscriptionModule');
        const choice = configService.get<string>('STT_PROVIDER')?.trim().toLowerCase() || 'groq';

        if (choice === 'xai' || choice === 'grok') {
          // Logged loudly: this one costs money per request.
          logger.warn('STT_PROVIDER=xai — voice transcription will use the paid xAI endpoint.');
          return xai;
        }

        if (choice !== 'groq') {
          // An unrecognised value is a typo, and silently falling back to a
          // paid provider would be the expensive way to find that out.
          logger.warn(`Unknown STT_PROVIDER "${choice}" — falling back to groq.`);
        }

        return groq;
      },
    },
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
