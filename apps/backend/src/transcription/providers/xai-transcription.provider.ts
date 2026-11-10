import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscribeInput, TranscriptionProvider, TranscriptionResult } from '../transcription.provider';

/**
 * xAI Speech-to-Text.
 *
 * Endpoint and model verified against docs.x.ai on 2026-11-10:
 *   POST https://api.x.ai/v1/stt  (multipart: model, file, language?, format?)
 *   default model grok-voice-transcribe-2.0
 *   response { text, language, duration, words[] }
 *
 * Billed per hour of audio for both REST and streaming — there is no
 * documented free tier. Keep MAX_AUDIO_BYTES tight and do not retry blindly.
 */
@Injectable()
export class XaiTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'xai';

  private readonly logger = new Logger(XaiTranscriptionProvider.name);
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('XAI_API_KEY')?.trim() || undefined;
    this.model = this.configService.get<string>('XAI_STT_MODEL')?.trim() || 'grok-voice-transcribe-2.0';
    this.baseUrl = this.configService.get<string>('XAI_API_BASE_URL')?.trim() || 'https://api.x.ai/v1';

    const configuredTimeout = Number(this.configService.get<string>('XAI_STT_TIMEOUT_MS')?.trim() || NaN);
    this.timeoutMs = Number.isInteger(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000;

    if (!this.apiKey) {
      // Warn rather than throw: the rest of the app must still boot and run
      // without voice capture configured.
      this.logger.warn('XAI_API_KEY is not set — voice transcription will reject requests until it is configured.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY is not configured');
    }

    const form = new FormData();
    form.append('model', this.model);
    form.append('file', new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), input.filename);
    if (input.language) {
      form.append('language', input.language);
    }

    // AbortSignal.timeout would also work, but an explicit controller keeps the
    // cleanup obvious and lets us distinguish our timeout from a network error.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/stt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`xAI transcription timed out after ${this.timeoutMs}ms`, { cause: error });
      }
      // Deliberately does not interpolate the error object, which can carry
      // request headers (and therefore the API key) in some runtimes.
      const message = error instanceof Error ? error.message : 'unknown network error';
      throw new Error(`Could not reach the xAI transcription service: ${message}`, {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Body may carry a useful provider message (bad model id, quota) but
      // could be large or HTML, so truncate and never log the request.
      const body = await response.text().catch(() => '');
      this.logger.error(`xAI STT returned ${response.status}: ${body.slice(0, 500) || '<empty body>'}`);
      throw new XaiTranscriptionHttpError(response.status);
    }

    const payload = (await response.json().catch(() => null)) as {
      text?: unknown;
      language?: unknown;
      duration?: unknown;
    } | null;

    if (!payload || typeof payload.text !== 'string') {
      throw new Error('xAI transcription returned an unexpected response shape');
    }

    return {
      text: payload.text,
      language: typeof payload.language === 'string' ? payload.language : undefined,
      durationSeconds: typeof payload.duration === 'number' ? payload.duration : undefined,
    };
  }
}

/** Carries the provider's HTTP status so the service can map it to a 4xx/5xx. */
export class XaiTranscriptionHttpError extends Error {
  constructor(readonly status: number) {
    super(`xAI transcription failed with status ${status}`);
    this.name = 'XaiTranscriptionHttpError';
  }
}
