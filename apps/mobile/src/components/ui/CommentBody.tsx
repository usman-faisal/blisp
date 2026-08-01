import type { ProjectMemberResponse } from '@repo/types';
import Text from './Text';

/**
 * Renders a comment body with @mentions highlighted.
 *
 * The backend already resolved which members were mentioned; this only has to
 * find the same spans to style them. It mirrors mentions.util.ts on the server:
 * longest name first, so with members "test" and "test user", "@test user"
 * highlights the whole name rather than just its first word.
 */
export function CommentBody({
  body,
  members,
}: {
  body: string;
  members: ProjectMemberResponse[];
}) {
  const segments = splitOnMentions(body, members);

  return (
    <Text className="text-sm leading-5 text-core-text-primary">
      {segments.map((segment, index) =>
        segment.isMention ? (
          <Text key={index} className="font-semibold text-brand-ember">
            {segment.text}
          </Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        ),
      )}
    </Text>
  );
}

interface Segment {
  text: string;
  isMention: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitOnMentions(body: string, members: ProjectMemberResponse[]): Segment[] {
  if (members.length === 0) return [{ text: body, isMention: false }];

  // Longest first, so a shorter name that prefixes a longer one does not claim
  // the match. Same ordering rule as the server.
  const names = members
    .map((member) => member.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  // The trailing guard stops "@test" matching inside "@testing".
  const pattern = new RegExp(`@(?:${names.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');

  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(pattern)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ text: body.slice(lastIndex, start), isMention: false });
    }
    segments.push({ text: match[0], isMention: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ text: body.slice(lastIndex), isMention: false });
  }

  return segments;
}
