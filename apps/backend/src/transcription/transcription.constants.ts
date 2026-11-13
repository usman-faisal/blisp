/**
 * Upload limits for voice capture.
 *
 * Providers allow far more (Groq 25 MB on the free tier, xAI 500 MB) but an
 * idea dump is seconds of speech, not minutes of video. A tight cap protects
 * the server's memory (uploads are held in RAM, never written to disk) and
 * keeps quota and billing predictable if a client ever misbehaves.
 */

/** 10 MB — roughly 10 minutes of the AAC that expo-audio HIGH_QUALITY emits. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Reject obviously-empty captures before paying for a request. */
export const MIN_AUDIO_BYTES = 1024;

/**
 * Intersection of what the STT providers accept and what Expo/React Native
 * realistically produces. Checked against the declared mime type OR the file
 * extension, because React Native's multipart encoder is inconsistent about
 * the former.
 *
 * Groq documents: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm. Bare
 * `.opus` is absent from that list and has been dropped — accepting an upload
 * the provider will reject wastes the user's recording and a request against
 * the daily quota. Opus inside an Ogg container (`.ogg`, `audio/ogg`) is
 * supported and is what Expo's Android recorder actually emits.
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
  'audio/flac',
  'audio/mpga',
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
  '.flac',
  '.mpga',
] as const;

/** Form field name the mobile client posts the recording under. */
export const AUDIO_FIELD_NAME = 'audio';
