/**
 * Resolves "@name" mentions in a comment body against a project's members.
 *
 * Names can contain spaces ("test user"), so a plain `@\w+` regex would only
 * catch the first word. Instead we match each known member name directly and
 * prefer the longest, so "@test user" does not resolve to a member called
 * "test" when both exist.
 */

export interface MentionCandidate {
  userId: string;
  name: string;
}

/** Escapes a name for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the ids of members named with @ in the body. Never returns
 * duplicates, and never returns a name that was not actually prefixed with @.
 */
export function extractMentionedUserIds(
  body: string,
  members: MentionCandidate[],
): string[] {
  if (!body.includes('@')) {
    return [];
  }

  // Longest first: with members "test" and "test user", "@test user" must
  // resolve to the latter rather than matching the shorter name and leaving
  // " user" as stray text.
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);

  const matched = new Set<string>();
  // Consumed spans, so a longer name that already matched cannot be
  // re-matched by a shorter one overlapping it.
  const consumed: Array<[number, number]> = [];

  for (const member of sorted) {
    if (!member.name) continue;

    // Case-insensitive, and the name must be followed by a boundary so
    // "@test user" does not match a member called "test users".
    const pattern = new RegExp(`@${escapeRegExp(member.name)}(?![\\p{L}\\p{N}_])`, 'giu');

    for (const match of body.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;

      const overlaps = consumed.some(([s, e]) => start < e && end > s);
      if (overlaps) continue;

      consumed.push([start, end]);
      matched.add(member.userId);
    }
  }

  return [...matched];
}

/** Trims a comment to a short preview for notification text. */
export function toExcerpt(body: string, maxLength = 80): string {
  const normalised = body.replace(/\s+/g, ' ').trim();

  return normalised.length <= maxLength
    ? normalised
    : `${normalised.slice(0, maxLength - 1).trimEnd()}…`;
}
