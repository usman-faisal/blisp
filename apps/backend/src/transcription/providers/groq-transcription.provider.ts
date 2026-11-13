import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscriptionHttpError } from '../transcription.errors';
import { TranscribeInput, TranscriptionProvider, TranscriptionResult } from '../transcription.provider';

/**
 * Groq Speech-to-Text (Whisper).
 *
 * Not to be confused with xAI's *Grok* — the names differ by one letter and the
 * commercial terms differ completely. Groq hosts OpenAI's Whisper models on its
 * own inference hardware and offers a free tier; xAI bills per audio hour with
 * no free tier. This project uses Groq for exactly that reason, and it is the
 * same key already serving the research stage (AI_PROVIDER=groq).
 *
 * Verified against console.groq.com/docs/speech-to-text on 2026-11-14:
 *   POST https://api.groq.com/openai/v1/audio/transcriptions
 *   multipart: model, file, language?, prompt?, response_format?, temperature?
 *   models: whisper-large-v3-turbo (faster/cheaper), whisper-large-v3 (accurate)
 *   response (json): { text }
 *   response (verbose_json): { text, language, duration, segments[] }
 *
 * Free-tier limits for whisper-large-v3-turbo, per Groq's rate-limit page:
 *   20 req/min, 2,000 req/day, 7,200 audio-seconds/hour, 28,800 audio-seconds/day
 *
 * Those are generous for brain dumps — a 30-second idea is 0.1% of the daily
 * audio allowance — but note any request under 10 seconds is *counted* as 10
 * seconds, so many tiny recordings cost more than their real duration. That is
 * another reason this provider never retries on its own.
 */
@Injectable()
export class GroqTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'groq';

  private readonly logger = new Logger(GroqTranscriptionProvider.name);
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    // Falls back to the shared GROQ_API_KEY: the research stage already needs
    // one, and asking for the same secret twice invites them to drift apart.
    // GROQ_STT_API_KEY exists only for the case where someone wants STT on a
    // separate key or quota.
    this.apiKey =
      this.configService.get<string>('GROQ_STT_API_KEY')?.trim() ||
      this.configService.get<string>('GROQ_API_KEY')?.trim() ||
      undefined;

    // Turbo by default: ~2x faster than whisper-large-v3 at near-identical
    // accuracy for short English speech, which is what a brain dump is. Set
    // GROQ_STT_MODEL=whisper-large-v3 if accented or multilingual audio needs it.
    this.model = this.configService.get<string>('GROQ_STT_MODEL')?.trim() || 'whisper-large-v3-turbo';

    // Deliberately NOT reusing GROQ_MODEL: that is the chat model
    // (gpt-oss-120b) and pointing an audio endpoint at it would 400 on every
    // request.
    this.baseUrl = this.configService.get<string>('GROQ_STT_BASE_URL')?.trim() || 'https://api.groq.com/openai/v1';

    const configuredTimeout = Number(this.configService.get<string>('GROQ_STT_TIMEOUT_MS')?.trim() || NaN);
    this.timeoutMs = Number.isInteger(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000;

    if (!this.apiKey) {
      // Warn rather than throw: the rest of the app must still boot and run
      // without voice capture configured.
      this.logger.warn('GROQ_API_KEY is not set — voice transcription will reject requests until it is configured.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const form = new FormData();
    form.append('model', this.model);
    form.append('file', new Blob([new Uint8Array(input.audio)], { type: input.mimeType }), input.filename);

    // verbose_json rather than the default json: plain json returns only
    // `text`, and the review sheet shows the recording's duration. One format
    // choice is cheaper than a second request to learn how long the audio was.
    form.append('response_format', 'verbose_json');

    // Whisper hallucinates fluent text into silence at higher temperatures.
    // Zero is the documented default, set explicitly because a transcript that
    // invents words the user never said is the worst failure mode here.
    form.append('temperature', '0');

    if (input.language) {
      form.append('language', input.language);
    }

    const response = await this.send(form);

    if (!response.ok) {
      // Body may carry a useful provider message (bad model id, quota) but
      // could be large or HTML, so truncate and never log the request.
      const body = await response.text().catch(() => '');
      this.logger.error(`Groq STT returned ${response.status}: ${body.slice(0, 500) || '<empty body>'}`);
      throw new TranscriptionHttpError(response.status, this.name);
    }

    const payload = (await response.json().catch(() => null)) as {
      text?: unknown;
      language?: unknown;
      duration?: unknown;
    } | null;

    if (!payload || typeof payload.text !== 'string') {
      throw new Error('Groq transcription returned an unexpected response shape');
    }

    return {
      text: payload.text,
      // Whisper reports a language *name* ("english"), not a BCP-47 code, so it
      // is passed through as-is rather than being mislabelled as a code.
      language: typeof payload.language === 'string' ? payload.language : undefined,
      durationSeconds: typeof payload.duration === 'number' ? payload.duration : undefined,
    };
  }

  /**
   * Performs the request, retrying only when the connection never got made.
   *
   * The distinction matters for quota. A retry here is safe precisely because
   * these failures happen *before* Groq receives anything: a DNS lookup that
   * returns EAI_AGAIN, or a refused/reset socket, costs no requests and no
   * audio-seconds. Anything Groq actually answered — including 429 and 5xx —
   * is returned untouched for the service to map, because retrying those would
   * silently multiply usage against a free tier.
   *
   * Observed in development: `getaddrinfo EAI_AGAIN api.groq.com` in bursts,
   * with the same request succeeding minutes later. Without this, a transient
   * resolver hiccup costs the user a recording they have already spoken, which
   * they cannot get back.
   */
  private async send(form: FormData): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      // A fresh controller per attempt: an aborted one stays aborted.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        return await fetch(`${this.baseUrl}/audio/transcriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
          signal: controller.signal,
        });
      } catch (error) {
        lastError = error;

        // A timeout means the request may well have reached Groq and be
        // running, so it is never retried — that would risk double-charging
        // the audio and is why this is checked before the retryable test.
        if (controller.signal.aborted) {
          throw new Error(`Groq transcription timed out after ${this.timeoutMs}ms`, { cause: error });
        }

        if (attempt === MAX_CONNECT_RETRIES || !isConnectFailure(error)) {
          break;
        }

        this.logger.warn(
          `Groq STT could not connect (${describeCause(error)}); ` +
            `retrying ${attempt + 1}/${MAX_CONNECT_RETRIES} in ${CONNECT_RETRY_DELAY_MS}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
      } finally {
        clearTimeout(timer);
      }
    }

    // Deliberately does not interpolate the error object, which can carry
    // request headers (and therefore the API key) in some runtimes.
    const message = lastError instanceof Error ? lastError.message : 'unknown network error';
    throw new Error(`Could not reach the Groq transcription service: ${message}`, {
      cause: lastError,
    });
  }
}

/**
 * One retry: enough for a momentary resolver blip, short enough that a user
 * holding their phone is not left waiting on a network that is properly down.
 */
const MAX_CONNECT_RETRIES = 1;
const CONNECT_RETRY_DELAY_MS = 400;

/** Node reports the real reason on `cause`; `fetch failed` is only a wrapper. */
function causeCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } })?.cause;
  return typeof cause?.code === 'string' ? cause.code : undefined;
}

function describeCause(error: unknown): string {
  return causeCode(error) ?? (error instanceof Error ? error.message : 'unknown');
}

/**
 * True only for failures that happened before the request reached Groq.
 *
 * EAI_AGAIN/ENOTFOUND are DNS; the rest are connection-level. Each means the
 * server never saw the audio, so re-sending cannot double-count usage.
 */
function isConnectFailure(error: unknown): boolean {
  const code = causeCode(error);
  return (
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'ETIMEDOUT'
  );
}
