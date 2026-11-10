import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { extname } from 'path';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
} from './transcription.constants';
import { TRANSCRIPTION_PROVIDER, TranscriptionProvider, TranscriptionResult } from './transcription.provider';
import { XaiTranscriptionHttpError } from './providers/xai-transcription.provider';

/** What the mobile client receives. Never includes provider internals. */
export interface TranscribeAudioResponse {
  transcript: string;
  language?: string;
  durationSeconds?: number;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    @Inject(TRANSCRIPTION_PROVIDER)
    private readonly provider: TranscriptionProvider,
  ) {}

  /**
   * Validates and transcribes one recording.
   *
   * `userId` is used only for correlating logs — audio and transcripts are
   * never persisted here. The brain-dump flow stores the text the user
   * actually confirms, which is deliberately a separate, explicit step.
   */
  async transcribeAudio(
    file: Express.Multer.File | undefined,
    userId: string,
    language?: string,
  ): Promise<TranscribeAudioResponse> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('No audio file was uploaded.');
    }

    if (file.buffer.length < MIN_AUDIO_BYTES) {
      throw new BadRequestException(
        'That recording is too short to transcribe. Hold the mic button and speak for a moment.',
      );
    }

    // Multer's own limit should catch this first; this is the backstop for a
    // misconfigured interceptor.
    if (file.buffer.length > MAX_AUDIO_BYTES) {
      throw new PayloadTooLargeException(
        `Recording is too large. The limit is ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))} MB.`,
      );
    }

    this.assertSupportedFormat(file);

    if (!this.provider.isConfigured()) {
      this.logger.error(`Transcription requested but provider "${this.provider.name}" is not configured.`);
      throw new ServiceUnavailableException('Voice transcription is not configured on the server yet.');
    }

    let result: TranscriptionResult;
    try {
      result = await this.provider.transcribe({
        audio: file.buffer,
        filename: file.originalname || 'recording.m4a',
        mimeType: file.mimetype || 'audio/m4a',
        language,
      });
    } catch (error) {
      throw this.toHttpError(error, userId);
    }

    const transcript = result.text.trim();

    if (!transcript) {
      // A successful call that heard nothing. Not an error upstream, but the
      // user needs to know their recording was silent.
      throw new BadRequestException("We couldn't hear anything in that recording. Try again in a quieter spot.");
    }

    // Log the outcome, never the content: transcripts are user ideas.
    this.logger.log(
      `Transcribed ${file.buffer.length} bytes for user ${userId} ` +
        `(${transcript.length} chars, ${result.durationSeconds ?? '?'}s)`,
    );

    return {
      transcript,
      language: result.language,
      durationSeconds: result.durationSeconds,
    };
  }

  /**
   * Accepts the upload when either the declared mime type or the filename
   * extension is recognised. React Native's multipart encoder frequently sends
   * `application/octet-stream`, so requiring both would reject valid audio.
   */
  private assertSupportedFormat(file: Express.Multer.File): void {
    const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    const extension = extname(file.originalname || '').toLowerCase();

    const mimeOk = (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(mime);
    const extensionOk = (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(extension);

    if (!mimeOk && !extensionOk) {
      throw new UnsupportedMediaTypeException(
        `Unsupported audio format "${mime || extension || 'unknown'}". ` +
          `Supported: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}.`,
      );
    }
  }

  /** Maps provider failures onto statuses the client can act on. */
  private toHttpError(error: unknown, userId: string): Error {
    if (error instanceof XaiTranscriptionHttpError) {
      // 401/403 is our key, not the user's problem; 429 and 5xx are transient.
      if (error.status === 401 || error.status === 403) {
        this.logger.error('Transcription provider rejected our credentials.');
        return new ServiceUnavailableException('Voice transcription is unavailable right now. Please try again later.');
      }

      if (error.status === 429) {
        return new ServiceUnavailableException(
          'Transcription is busy at the moment. Please try again in a few seconds.',
        );
      }

      if (error.status === 413) {
        return new PayloadTooLargeException('That recording is too long to transcribe.');
      }

      if (error.status >= 400 && error.status < 500) {
        return new BadRequestException('That recording could not be transcribed.');
      }

      return new BadGatewayException('The transcription service failed. Please try again.');
    }

    const message = error instanceof Error ? error.message : 'unknown error';
    this.logger.error(`Transcription failed for user ${userId}: ${message}`);

    return new BadGatewayException('Could not transcribe that recording. Please try again.');
  }
}
