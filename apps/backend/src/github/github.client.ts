import { Injectable, Logger } from '@nestjs/common';

/**
 * A read-only GitHub API client.
 *
 * Read-only is a design constraint, not an omission: BLISP observes a
 * repository to corroborate completion claims, and nothing about that job
 * requires write access. Keeping it to GET means a compromised token cannot
 * alter a user's code, and it is a far easier property to defend than "we only
 * call write endpoints we believe are safe".
 *
 * Works unauthenticated for public repositories (60 requests/hour) and with a
 * token when one is supplied (5,000/hour). The unauthenticated path is the
 * default because the common case — a student's own public project — needs no
 * secret at all, and a feature that works without asking for credentials is
 * one fewer thing to get wrong.
 *
 * Verified against docs.github.com REST v3 on 2026-11-14.
 */

export interface GithubRepoInfo {
  githubId: number;
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GithubCommit {
  sha: string;
  message: string;
  url: string;
  authorLogin: string | null;
  occurredAt: Date;
}

/** Carries the HTTP status so callers can distinguish 404 from 403 from 5xx. */
export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Seconds until the rate limit resets, when GitHub reports one. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GithubApiError';
  }
}

const API_BASE = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Commits fetched per sync.
 *
 * One page. A project's evidence is "what changed recently", and walking the
 * entire history would spend the unauthenticated hourly budget on a single
 * sync of one repository.
 */
const COMMITS_PER_PAGE = 100;

@Injectable()
export class GithubClient {
  private readonly logger = new Logger(GithubClient.name);

  /** Parses "owner/name", a full URL, or a .git suffix into its parts. */
  static parseRepo(input: string): { owner: string; name: string } | null {
    const trimmed = input
      .trim()
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');

    // A full URL, with or without protocol.
    const urlMatch = /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)/i.exec(trimmed);
    if (urlMatch) {
      return { owner: urlMatch[1], name: urlMatch[2] };
    }

    // Bare "owner/name". Anchored so a path with extra segments is rejected
    // rather than silently truncated to something the user did not mean.
    const shorthand = /^([A-Za-z0-9-_.]+)\/([A-Za-z0-9-_.]+)$/.exec(trimmed);
    if (shorthand) {
      return { owner: shorthand[1], name: shorthand[2] };
    }

    return null;
  }

  async getRepository(owner: string, name: string, token?: string | null): Promise<GithubRepoInfo> {
    const payload = await this.get<{
      id: number;
      name: string;
      owner: { login: string };
      default_branch: string;
      private: boolean;
    }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, token);

    return {
      githubId: payload.id,
      owner: payload.owner.login,
      name: payload.name,
      defaultBranch: payload.default_branch,
      isPrivate: payload.private,
    };
  }

  /**
   * Recent commits on the default branch.
   *
   * `since` makes a re-sync cost one small page instead of the whole history,
   * which is what keeps this usable on the unauthenticated budget.
   */
  async listCommits(
    owner: string,
    name: string,
    options: { since?: Date | null; token?: string | null } = {},
  ): Promise<GithubCommit[]> {
    const params = new URLSearchParams({ per_page: String(COMMITS_PER_PAGE) });
    if (options.since) {
      params.set('since', options.since.toISOString());
    }

    const payload = await this.get<
      {
        sha: string;
        html_url: string;
        commit: { message: string; author: { date: string } | null };
        author: { login: string } | null;
      }[]
    >(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits?${params.toString()}`, options.token);

    if (!Array.isArray(payload)) {
      throw new GithubApiError(502, 'GitHub returned an unexpected commits response.');
    }

    return payload
      .filter((item) => item && typeof item.sha === 'string')
      .map((item) => ({
        sha: item.sha,
        message: item.commit?.message ?? '',
        url: item.html_url,
        // Null for a commit whose email is not linked to a GitHub account —
        // common, and not an error.
        authorLogin: item.author?.login ?? null,
        occurredAt: item.commit?.author?.date ? new Date(item.commit.author.date) : new Date(0),
      }));
  }

  private async get<T>(path: string, token?: string | null): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // GitHub asks automated clients to identify themselves. Deliberately a
      // generic product name: it must not carry the user's identity.
      'User-Agent': 'blisp-app',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, { headers, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new GithubApiError(504, 'GitHub did not respond in time.');
      }
      // Never interpolates the error object: it can carry request headers, and
      // therefore the token, in some runtimes.
      const message = error instanceof Error ? error.message : 'unknown network error';
      throw new GithubApiError(502, `Could not reach GitHub: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw this.toApiError(response, await response.text().catch(() => ''));
    }

    return (await response.json()) as T;
  }

  /** Maps a GitHub response onto an error with a message worth showing. */
  private toApiError(response: Response, body: string): GithubApiError {
    const { status } = response;

    // 403 with the remaining budget at zero is a rate limit, not a permission
    // problem — the two need completely different messages.
    const remaining = response.headers.get('x-ratelimit-remaining');
    if ((status === 403 || status === 429) && remaining === '0') {
      const resetAt = Number(response.headers.get('x-ratelimit-reset') ?? 0);
      const retryAfterSeconds = resetAt > 0 ? Math.max(0, resetAt - Math.floor(Date.now() / 1000)) : undefined;

      return new GithubApiError(
        429,
        'GitHub rate limit reached. Linking a token raises the limit, or try again shortly.',
        retryAfterSeconds,
      );
    }

    if (status === 404) {
      // 404 is also what GitHub returns for a private repo you cannot see, so
      // the message covers both rather than asserting the repo does not exist.
      return new GithubApiError(404, 'Repository not found, or it is private and no token was provided.');
    }

    if (status === 401) {
      return new GithubApiError(401, 'GitHub rejected the token.');
    }

    this.logger.error(`GitHub ${status}: ${body.slice(0, 300) || '<empty body>'}`);
    return new GithubApiError(status, 'GitHub request failed.');
  }
}
