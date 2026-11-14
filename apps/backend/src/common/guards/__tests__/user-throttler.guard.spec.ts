import { UserThrottlerGuard } from '../user-throttler.guard';

/**
 * Only the fields getTracker reads. Express's Request already declares `user`
 * as a full User via the Passport types, so building a complete row here would
 * add six irrelevant fields to every case without testing anything more.
 */
type TrackerRequest = {
  user?: { id: string };
  ip?: string;
  ips?: string[];
  headers?: { authorization?: string };
};

/** A JWT with the given `sub`. Unsigned — the guard never verifies it. */
function bearer(sub: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `Bearer ${part({ alg: 'RS256' })}.${part({ sub })}.not-a-real-signature`;
}

/**
 * The tracker decides whose budget a request spends. Getting it wrong is not a
 * cosmetic bug: keying on IP would put every mobile user behind one carrier NAT
 * into a shared bucket, so one user's activity would throttle strangers.
 *
 * The important detail these tests pin down is that the token path, not
 * `request.user`, is what actually runs in this app. This guard is global and
 * AuthGuard is controller-scoped, so `request.user` is still undefined when the
 * tracker is called on a normal request — an earlier version read only
 * `request.user`, passed its unit tests, and silently keyed every request on
 * the IP. Hence the cases below supply a header rather than a user.
 *
 * The guard is constructed with empty collaborators because getTracker touches
 * none of them.
 */
describe('UserThrottlerGuard — tracker', () => {
  const guard = new UserThrottlerGuard({ throttlers: [] } as never, {} as never, {} as never);

  const track = (req: TrackerRequest) =>
    (guard as unknown as { getTracker(r: TrackerRequest): Promise<string> }).getTracker(req);

  describe('the real request shape — bearer token, no request.user yet', () => {
    it('keys on the token subject', async () => {
      await expect(track({ headers: { authorization: bearer('user_abc') }, ip: '203.0.113.9' })).resolves.toBe(
        'user:user_abc',
      );
    });

    it('separates two users sharing one IP', async () => {
      // The carrier-NAT case, via the path production actually takes.
      const [first, second] = await Promise.all([
        track({ headers: { authorization: bearer('user_one') }, ip: '203.0.113.9' }),
        track({ headers: { authorization: bearer('user_two') }, ip: '203.0.113.9' }),
      ]);

      expect(first).not.toBe(second);
    });

    it('ignores the IP entirely once a subject is known', async () => {
      // Same user, two networks: one budget, so switching networks does not
      // hand out a fresh allowance.
      const [home, mobile] = await Promise.all([
        track({ headers: { authorization: bearer('user_abc') }, ip: '203.0.113.9' }),
        track({ headers: { authorization: bearer('user_abc') }, ip: '198.51.100.4' }),
      ]);

      expect(home).toBe(mobile);
    });

    it('agrees with the resolved user, so the two paths share one bucket', async () => {
      // A route where AuthGuard ran first must not get a second allowance under
      // a different key.
      const [fromToken, fromUser] = await Promise.all([
        track({ headers: { authorization: bearer('user_abc') } }),
        track({ user: { id: 'user_abc' } }),
      ]);

      expect(fromToken).toBe(fromUser);
    });
  });

  describe('when AuthGuard has already resolved the user', () => {
    it('prefers the verified identity over the token claim', async () => {
      await expect(
        track({ user: { id: 'user_verified' }, headers: { authorization: bearer('user_claimed') } }),
      ).resolves.toBe('user:user_verified');
    });
  });

  describe('falling back to the IP', () => {
    it('keys an anonymous request on its address', async () => {
      await expect(track({ ip: '203.0.113.9' })).resolves.toBe('ip:203.0.113.9');
    });

    it('prefers the forwarded client address behind a proxy', async () => {
      // Behind a trusted proxy express populates req.ips; req.ip would then be
      // the proxy itself, which every client shares.
      await expect(track({ ips: ['203.0.113.9', '10.0.0.1'], ip: '10.0.0.1' })).resolves.toBe('ip:203.0.113.9');
    });

    it('never collides a user id with an ip', async () => {
      // The prefixes exist so a user literally named after an address cannot
      // land in the same bucket as that address.
      const [asUser, asIp] = await Promise.all([track({ user: { id: '203.0.113.9' } }), track({ ip: '203.0.113.9' })]);

      expect(asUser).not.toBe(asIp);
    });
  });

  describe('malformed tokens fall back rather than throwing', () => {
    // Rejecting the request is AuthGuard's job. The tracker only has to pick a
    // bucket, so every bad shape degrades to the IP.
    const cases: [string, string | undefined][] = [
      ['no header at all', undefined],
      ['not a bearer scheme', 'Basic dXNlcjpwYXNz'],
      ['bearer with no token', 'Bearer '],
      ['wrong segment count', 'Bearer abc.def'],
      ['payload is not base64', 'Bearer abc.!!!not-base64!!!.sig'],
      ['payload is not JSON', `Bearer abc.${Buffer.from('plain text').toString('base64url')}.sig`],
      ['payload is JSON but not an object', `Bearer abc.${Buffer.from('"a string"').toString('base64url')}.sig`],
      ['payload has no sub', `Bearer abc.${Buffer.from(JSON.stringify({ iss: 'clerk' })).toString('base64url')}.sig`],
      ['sub is not a string', `Bearer abc.${Buffer.from(JSON.stringify({ sub: 12345 })).toString('base64url')}.sig`],
      ['sub is empty', `Bearer abc.${Buffer.from(JSON.stringify({ sub: '' })).toString('base64url')}.sig`],
    ];

    it.each(cases)('%s', async (_label, authorization) => {
      await expect(track({ headers: { authorization }, ip: '203.0.113.9' })).resolves.toBe('ip:203.0.113.9');
    });
  });
});
