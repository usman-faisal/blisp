import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai.service';

/**
 * Provider selection, which decides every LLM call the app makes.
 *
 * Worth covering because misconfiguration here used to fail silently: an unset
 * AI_PROVIDER left the model undefined and surfaced much later, inside a queue
 * job, as a confusing error rather than at boot.
 */
describe('AiService — provider selection', () => {
  /** Builds the service against a fixed env, as ConfigService would resolve it. */
  async function buildWith(env: Record<string, string | undefined>): Promise<AiService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    return module.get<AiService>(AiService);
  }

  /** The model id, however the SDK represents the model. */
  function modelIdOf(service: AiService): string {
    const model = (service as unknown as { model: string | { modelId: string } }).model;
    return typeof model === 'string' ? model : model.modelId;
  }

  function retriesOf(service: AiService): number {
    return (service as unknown as { maxRetries: number }).maxRetries;
  }

  describe('openrouter', () => {
    const base = { AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'key' };

    it('uses the configured model', async () => {
      const service = await buildWith({ ...base, OPENROUTER_MODEL: 'vendor/some-model' });

      expect(modelIdOf(service)).toBe('vendor/some-model');
    });

    it('refuses to start without a model, rather than guessing one', async () => {
      // Unlike the other providers there is no sensible default: the catalogue
      // is large and its free tier rotates, so a guess would break silently.
      await expect(buildWith(base)).rejects.toThrow(/OPENROUTER_MODEL/);
    });

    it('refuses to start without an API key', async () => {
      await expect(buildWith({ AI_PROVIDER: 'openrouter', OPENROUTER_MODEL: 'vendor/some-model' })).rejects.toThrow(
        /OPENROUTER_API_KEY/,
      );
    });
  });

  describe('gemini', () => {
    it('falls back to a default model when none is configured', async () => {
      const service = await buildWith({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' });

      expect(modelIdOf(service)).toBe('gemini-2.0-flash-lite');
    });

    it('prefers the configured model over the default', async () => {
      const service = await buildWith({
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'key',
        GEMINI_MODEL: 'gemini-9-turbo',
      });

      expect(modelIdOf(service)).toBe('gemini-9-turbo');
    });

    it('refuses to start without an API key', async () => {
      await expect(buildWith({ AI_PROVIDER: 'gemini' })).rejects.toThrow(/GEMINI_API_KEY/);
    });
  });

  describe('github', () => {
    it('falls back to a default model when none is configured', async () => {
      const service = await buildWith({ AI_PROVIDER: 'github', GITHUB_TOKEN: 'token' });

      expect(modelIdOf(service)).toBe('openai/gpt-4o-mini');
    });

    it('prefers the configured model over the default', async () => {
      const service = await buildWith({
        AI_PROVIDER: 'github',
        GITHUB_TOKEN: 'token',
        GITHUB_MODEL: 'vendor/other-model',
      });

      expect(modelIdOf(service)).toBe('vendor/other-model');
    });
  });

  describe('an unusable provider', () => {
    it('fails at boot when AI_PROVIDER is unset', async () => {
      await expect(buildWith({})).rejects.toThrow(/AI_PROVIDER/);
    });

    it('fails at boot when AI_PROVIDER is misspelled', async () => {
      await expect(buildWith({ AI_PROVIDER: 'gemeni' })).rejects.toThrow(/gemeni/);
    });
  });

  describe('maxRetries', () => {
    const base = { AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' };

    it('defaults to 2 when unset', async () => {
      expect(retriesOf(await buildWith(base))).toBe(2);
    });

    it('honours a configured value', async () => {
      expect(retriesOf(await buildWith({ ...base, AI_MAX_RETRIES: '5' }))).toBe(5);
    });

    it('honours an explicit 0', async () => {
      expect(retriesOf(await buildWith({ ...base, AI_MAX_RETRIES: '0' }))).toBe(0);
    });

    it('falls back to the default on a blank value, not to 0', async () => {
      // Number('') is 0, so a blank AI_MAX_RETRIES= would otherwise silently
      // disable retries — the exact behaviour the default was added to remove.
      expect(retriesOf(await buildWith({ ...base, AI_MAX_RETRIES: '   ' }))).toBe(2);
    });

    it('falls back to the default on a non-numeric value', async () => {
      expect(retriesOf(await buildWith({ ...base, AI_MAX_RETRIES: 'two' }))).toBe(2);
    });
  });
});

/**
 * Tavily transport behaviour.
 *
 * This machine intermittently fails DNS with EAI_AGAIN. Without a retry, a
 * blip leaves a daily plan's tasks with no resources attached and a research
 * report with no sources — indistinguishable, to the user, from "we searched
 * and found nothing".
 */
describe('AiService — Tavily search', () => {
  const ORIGINAL_FETCH = global.fetch;

  async function build(): Promise<AiService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'k', GROQ_MODEL: 'm', TAVILY_API_KEY: 'tvly-test' })[key],
          },
        },
      ],
    }).compile();

    return module.get<AiService>(AiService);
  }

  /** Mirrors Node: the real reason is on `cause.code`, not the message. */
  function connectError(code: string): Error {
    return Object.assign(new Error('fetch failed'), { cause: Object.assign(new Error(code), { code }) });
  }

  function okResponse(results: unknown[]) {
    return { ok: true, status: 200, json: () => Promise.resolve({ results }) };
  }

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  it('retries a DNS failure and succeeds on the second attempt', async () => {
    const spy = jest
      .fn()
      .mockRejectedValueOnce(connectError('EAI_AGAIN'))
      .mockResolvedValueOnce(okResponse([{ title: 'a', url: 'https://x' }]));
    global.fetch = spy as unknown as typeof fetch;

    const result = await (await build()).searchWithStatus('react testing');

    expect(result.failed).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reports failure after the retry is exhausted', async () => {
    const spy = jest.fn().mockRejectedValue(connectError('EAI_AGAIN'));
    global.fetch = spy as unknown as typeof fetch;

    const result = await (await build()).searchWithStatus('react testing');

    // failed:true is what stops a sourceless report being saved as a normal one.
    expect(result.failed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry an HTTP error — that would multiply quota usage', async () => {
    const spy = jest.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({}) });
    global.fetch = spy as unknown as typeof fetch;

    const result = await (await build()).searchWithStatus('react testing');

    expect(result.failed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('treats an empty result set from a 200 as a real answer, not a failure', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse([])) as unknown as typeof fetch;

    const result = await (await build()).searchWithStatus('nothing matches this');

    expect(result).toEqual({ results: [], failed: false });
  });

  it('retries for the resource path too, so a blip does not cost resources', async () => {
    // search() is what the daily-plan resource fetch uses. It collapses errors
    // into [], so without the retry a blip silently yields no resources.
    const spy = jest
      .fn()
      .mockRejectedValueOnce(connectError('ECONNRESET'))
      .mockResolvedValueOnce(okResponse([{ title: 'guide', url: 'https://g' }]));
    global.fetch = spy as unknown as typeof fetch;

    const results = await (await build()).search('how to test');

    expect(results).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
