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
      await expect(
        buildWith({ AI_PROVIDER: 'openrouter', OPENROUTER_MODEL: 'vendor/some-model' }),
      ).rejects.toThrow(/OPENROUTER_API_KEY/);
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
