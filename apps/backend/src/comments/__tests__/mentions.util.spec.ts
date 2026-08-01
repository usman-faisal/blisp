import { extractMentionedUserIds, toExcerpt } from '../mentions.util';

describe('extractMentionedUserIds', () => {
  const members = [
    { userId: 'u_alice', name: 'Alice' },
    { userId: 'u_bob', name: 'test user' },
    { userId: 'u_carol', name: 'test' },
  ];

  it('resolves a simple mention', () => {
    expect(extractMentionedUserIds('@Alice can you look?', members)).toEqual(['u_alice']);
  });

  // Names contain spaces, so `@\w+` would only ever catch the first word.
  it('resolves a mention whose name contains a space', () => {
    expect(extractMentionedUserIds('@test user please review', members)).toEqual(['u_bob']);
  });

  // The ambiguous case: "test" is a prefix of "test user".
  it('prefers the longest matching name', () => {
    const result = extractMentionedUserIds('@test user please review', members);

    expect(result).toEqual(['u_bob']);
    expect(result).not.toContain('u_carol');
  });

  it('still resolves the shorter name when it stands alone', () => {
    expect(extractMentionedUserIds('@test look here', members)).toEqual(['u_carol']);
  });

  it('resolves several mentions in one comment', () => {
    const result = extractMentionedUserIds('@Alice and @test user — thoughts?', members);

    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['u_alice', 'u_bob']));
  });

  it('never returns duplicates', () => {
    expect(extractMentionedUserIds('@Alice @Alice @Alice', members)).toEqual(['u_alice']);
  });

  it('is case-insensitive', () => {
    expect(extractMentionedUserIds('@alice hi', members)).toEqual(['u_alice']);
  });

  it('ignores a name that is not prefixed with @', () => {
    expect(extractMentionedUserIds('Alice said the build is green', members)).toEqual([]);
  });

  it('ignores a mention of someone outside the project', () => {
    expect(extractMentionedUserIds('@Dave can you help?', members)).toEqual([]);
  });

  // "@test users" must not resolve to the member "test user".
  it('requires a word boundary after the name', () => {
    expect(extractMentionedUserIds('@test users are great', members)).not.toContain('u_bob');
  });

  it('returns nothing when the body has no @ at all', () => {
    expect(extractMentionedUserIds('looks good to me', members)).toEqual([]);
  });

  it('handles an empty member list', () => {
    expect(extractMentionedUserIds('@anyone', [])).toEqual([]);
  });

  // A name with regex metacharacters must not blow up the matcher.
  it('escapes regex characters in names', () => {
    const odd = [{ userId: 'u_x', name: 'a.b*c' }];

    expect(extractMentionedUserIds('@a.b*c hello', odd)).toEqual(['u_x']);
    expect(extractMentionedUserIds('@axbxc hello', odd)).toEqual([]);
  });
});

describe('toExcerpt', () => {
  it('returns short text unchanged', () => {
    expect(toExcerpt('Looks good')).toBe('Looks good');
  });

  it('collapses whitespace and newlines', () => {
    expect(toExcerpt('Looks   good\n\nto me')).toBe('Looks good to me');
  });

  it('truncates long text with an ellipsis', () => {
    const result = toExcerpt('x'.repeat(200));

    expect(result).toHaveLength(80);
    expect(result.endsWith('…')).toBe(true);
  });
});
