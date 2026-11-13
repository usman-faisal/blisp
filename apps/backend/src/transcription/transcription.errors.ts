/**
 * Transport-level failure from whichever STT provider is bound.
 *
 * Lives outside ./providers on purpose. TranscriptionService maps these
 * statuses onto HTTP responses, so importing the error from a vendor-specific
 * file would make the "provider-agnostic" service silently vendor-specific: a
 * 429 from any provider other than the one it imported would fall through to a
 * generic 502 and lose the "try again in a few seconds" message.
 */
export class TranscriptionHttpError extends Error {
  constructor(
    readonly status: number,
    /** Provider id, for logs — never shown to the user. */
    readonly provider = 'stt',
  ) {
    super(`${provider} transcription failed with status ${status}`);
    this.name = 'TranscriptionHttpError';
  }
}
