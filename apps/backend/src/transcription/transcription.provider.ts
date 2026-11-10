/**
 * Provider-agnostic contract for speech-to-text.
 *
 * The UI and the brain-dump flow depend on this shape, not on xAI, so swapping
 * provider (or adding a fallback) is a module-level change rather than a
 * rewrite of the mobile recording screen.
 */
export interface TranscriptionResult {
  /** The transcript. May legitimately be empty for silent audio. */
  text: string;
  /** BCP-47-ish code the provider detected, when it reports one. */
  language?: string;
  /** Audio length in seconds, when the provider reports it. */
  durationSeconds?: number;
}

export interface TranscribeInput {
  audio: Buffer;
  /** Original filename — providers use its extension to sniff the container. */
  filename: string;
  mimeType: string;
  /** Optional hint; omit to let the provider auto-detect. */
  language?: string;
}

export interface TranscriptionProvider {
  /** Human-readable provider id, for logs and error messages. */
  readonly name: string;
  /**
   * False when the provider lacks the configuration it needs (e.g. no API
   * key). Checked before upload so we can reject early with a clear message
   * instead of burning the user's recording on a request that cannot succeed.
   */
  isConfigured(): boolean;
  transcribe(input: TranscribeInput): Promise<TranscriptionResult>;
}

/** DI token — the interface itself cannot be one at runtime. */
export const TRANSCRIPTION_PROVIDER = Symbol('TRANSCRIPTION_PROVIDER');
