/**
 * Rate limits, grouped by what the limit is actually protecting.
 *
 * Three different concerns, so three different budgets rather than one global
 * number:
 *
 *   - `DEFAULT` protects the server. Ordinary CRUD is cheap, so this is
 *     generous; it exists to stop a runaway client loop, not to ration use.
 *   - `TRANSCRIPTION` and `AI` protect a third-party quota that is metered and
 *     not replenishable on demand. Groq's free tier allows 2,000 requests and
 *     7,200 audio-seconds per day across the whole deployment, so an
 *     unthrottled client loop can exhaust a day's capacity for every user in
 *     minutes. These limits are deliberately close to real human pace.
 *   - `GITHUB_SYNC` protects GitHub's 60-requests-per-hour unauthenticated
 *     budget, which is shared per source IP rather than per user.
 *
 * `ttl` is milliseconds, matching @nestjs/throttler v6.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Ordinary reads and writes. Guards against a client loop, not against use. */
export const THROTTLE_DEFAULT = { ttl: MINUTE, limit: 120 };

/**
 * Voice capture. A person reviews each transcript before submitting it, so
 * 10/minute is already far above deliberate use while still absorbing a few
 * retries after a failed recording.
 */
export const THROTTLE_TRANSCRIPTION = { ttl: MINUTE, limit: 10 };

/**
 * LLM-backed generation: brain dump processing, research, roadmap generation.
 * Each call is seconds of model time and several Tavily searches, and the
 * results are cached per project, so repeated calls are nearly always a bug or
 * an impatient tap rather than intent.
 */
export const THROTTLE_AI = { ttl: HOUR, limit: 30 };

/**
 * Repository sync. Each sync is 1–2 GitHub calls against a 60/hour
 * unauthenticated budget, and syncing twice in a row returns the same commits
 * because `since` is advanced on success.
 */
export const THROTTLE_GITHUB_SYNC = { ttl: HOUR, limit: 20 };
