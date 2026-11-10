/**
 * Upload limits for voice capture.
 *
 * xAI accepts files up to 500 MB, but an idea dump is seconds of speech, not
 * minutes of video. A tight cap protects the server's memory (uploads are held
 * in RAM, never written to disk) and keeps the paid per-hour STT bill
 * predictable if a client ever misbehaves.
 */

/** 10 MB — roughly 10 minutes of the AAC that expo-audio HIGH_QUALITY emits. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Reject obviously-empty captures before paying for a request. */
export const MIN_AUDIO_BYTES = 1024;

/**
 * Intersection of what xAI documents and what Expo/React Native realistically
 * produce. Checked against the declared mime type AND the file extension,
 * because React Native's multipart encoder is inconsistent about the former.
 */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'video/mp4',
] as const;

export const ALLOWED_AUDIO_EXTENSIONS = [
  '.m4a',
  '.mp4',
  '.aac',
  '.mp3',
  '.wav',
  '.webm',
  '.ogg',
  '.opus',
  '.flac',
] as const;

/** Form field name the mobile client posts the recording under. */
export const AUDIO_FIELD_NAME = 'audio';
