import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { User } from '@repo/db';

/**
 * Rate limiting keyed on the caller's identity rather than their IP address.
 *
 * The default ThrottlerGuard buckets by IP, which is wrong for this app in both
 * directions. Mobile clients sit behind carrier NAT, so unrelated users share
 * one address and would exhaust a shared bucket for each other; meanwhile a
 * single abusive user need only change networks to get a fresh allowance.
 *
 * WHY THE TOKEN IS PARSED HERE INSTEAD OF READING `request.user`:
 *
 * This guard is registered globally via APP_GUARD, and Nest runs global guards
 * *before* controller-scoped ones. AuthGuard is applied per controller with
 * @UseGuards, so it has not run yet and `request.user` is still undefined at
 * this point. Reading it would make every request fall back to the IP branch —
 * which is exactly the behaviour this class exists to avoid, and it fails
 * silently: the limit still works, it is just keyed on the wrong thing.
 *
 * So the subject claim is read straight from the bearer token. This is NOT
 * authentication: the signature is not checked here, and nothing is trusted
 * beyond "requests carrying this token share a budget". AuthGuard still
 * verifies the token properly before any handler runs, so a forged token buys
 * an attacker nothing except their own private rate-limit bucket — which is
 * strictly worse for them than sharing the IP bucket.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request & { user?: User }): Promise<string> {
    // Set when AuthGuard happens to have run first (route-scoped throttling on
    // a controller whose guard precedes this one). Preferred when present: it
    // is the verified identity.
    const resolved = req.user?.id;

    if (resolved) {
      return Promise.resolve(`user:${resolved}`);
    }

    const subject = subjectFromBearer(req.headers?.authorization);

    if (subject) {
      return Promise.resolve(`user:${subject}`);
    }

    // Genuinely anonymous (a @Public route). The IP is all there is to key on.
    // `req.ips` is populated behind a trusted proxy; `req.ip` otherwise.
    return Promise.resolve(`ip:${req.ips?.length ? req.ips[0] : req.ip}`);
  }
}

/**
 * Reads the `sub` claim out of a JWT without verifying it.
 *
 * Deliberately hand-rolled rather than using a JWT library: pulling in
 * verification here would imply this value is trusted, and it is not. Any
 * malformed input returns null and the caller falls back to the IP.
 */
function subjectFromBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const parts = header.slice('Bearer '.length).trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    if (typeof payload === 'object' && payload !== null) {
      const sub = (payload as { sub?: unknown }).sub;

      if (typeof sub === 'string' && sub.length > 0) {
        return sub;
      }
    }

    return null;
  } catch {
    // A token we cannot parse is not a reason to reject the request — that is
    // AuthGuard's decision, not this guard's.
    return null;
  }
}
