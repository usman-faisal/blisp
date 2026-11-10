import { AxiosError } from 'axios';
import { apiClient } from './client';

export interface TranscribeAudioResult {
  transcript: string;
  language?: string;
  durationSeconds?: number;
}

/** Mirrors the backend's size cap so we can fail before a pointless upload. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * A transcription failure the UI can show verbatim.
 *
 * `retryable` distinguishes "try again" (provider busy, network) from
 * "re-record" (silent or malformed audio), so the review sheet can offer the
 * right action instead of a generic alert.
 */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/**
 * Uploads a recording and returns the transcript for the user to review.
 *
 * Deliberately does not create a brain dump — the caller submits the edited
 * text through createBrainDump once the user confirms.
 */
export async function transcribeAudio(
  uri: string,
  options: { language?: string; mimeType?: string } = {},
): Promise<TranscribeAudioResult> {
  const form = new FormData();

  const filename = uri.split('/').pop() || 'recording.m4a';
  const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'm4a';
  const mimeType = options.mimeType ?? guessMimeType(extension);

  // React Native's FormData takes this {uri,name,type} shape rather than a Blob.
  form.append('audio', {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  if (options.language) {
    form.append('language', options.language);
  }

  try {
    const response = await apiClient.post<TranscribeAudioResult>('/transcription/audio', form, {
      // The shared instance defaults to application/json; letting axios set
      // this itself is what adds the multipart boundary.
      headers: { 'Content-Type': 'multipart/form-data' },
      // Transcription is a round trip to a paid provider — the default timeout
      // is too aggressive for a minute of speech.
      timeout: 90_000,
      transformRequest: (data) => data,
    });

    return response.data;
  } catch (error) {
    throw toTranscriptionError(error);
  }
}

function guessMimeType(extension: string): string {
  switch (extension) {
    case 'm4a':
      return 'audio/m4a';
    case 'mp4':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'webm':
      return 'audio/webm';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'caf':
      return 'audio/x-caf';
    default:
      return 'audio/m4a';
  }
}

/** Turns an axios failure into a message worth showing, using the server's own text. */
function toTranscriptionError(error: unknown): TranscriptionError {
  const axiosError = error as AxiosError<{ message?: string }>;

  if (!axiosError?.isAxiosError) {
    return new TranscriptionError(
      'Something went wrong while transcribing. Please try again.',
      true,
    );
  }

  if (!axiosError.response) {
    return new TranscriptionError(
      'Could not reach BLISP. Check your connection and try again.',
      true,
    );
  }

  const status = axiosError.response.status;
  const serverMessage = axiosError.response.data?.message;

  // 4xx other than 429 means this recording will never succeed — re-record.
  // 429/5xx are transient, so the same audio is worth retrying.
  const retryable = status === 429 || status >= 500;

  const fallback =
    status === 401
      ? 'Your session expired. Sign in again to transcribe.'
      : status === 413
        ? 'That recording is too long. Try a shorter one.'
        : status === 415
          ? 'That audio format is not supported.'
          : status === 503
            ? 'Voice transcription is not available right now.'
            : 'That recording could not be transcribed.';

  return new TranscriptionError(serverMessage || fallback, retryable, status);
}
