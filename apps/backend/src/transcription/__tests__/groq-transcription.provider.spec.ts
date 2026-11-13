import { ConfigService } from '@nestjs/config';
import { GroqTranscriptionProvider } from '../providers/groq-transcription.provider';
import { TranscriptionHttpError } from '../transcription.errors';

/**
 * The Groq STT provider, against a mocked fetch.
 *
 * Every test here stubs global.fetch. Nothing in this file reaches the network,
 * which matters more than usual: the free tier is metered in audio-seconds per
 * day and any request under 10 seconds is counted as 10, so a test suite that
 * called the real endpoint would quietly consume the quota the demo needs.
 */
describe('GroqTranscriptionProvider', () => {
  const ORIGINAL_FETCH = global.fetch;

  function makeProvider(env: Record<string, string | undefined> = {}): GroqTranscriptionProvider {
    const config = {
      get: (key: string) => env[key],
    } as unknown as ConfigService;

    return new GroqTranscriptionProvider(config);
  }

  function makeInput() {
    return {
      audio: Buffer.from('fake audio bytes'),
      filename: 'recording.m4a',
      mimeType: 'audio/m4a',
    };
  }

  /** The arguments the provider passes to fetch, typed so assertions are safe. */
  type FetchCall = [url: string, init: { method: string; headers: Record<string, string>; body: FormData }];

  /** Captures the request the provider builds without performing it. */
  function mockFetch(response: { ok?: boolean; status?: number; jsonBody?: unknown }) {
    const spy = jest.fn<Promise<Response>, FetchCall>().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: () => Promise.resolve(response.jsonBody ?? { text: 'an idea' }),
      text: () => Promise.resolve(JSON.stringify(response.jsonBody ?? {})),
    } as unknown as Response);

    global.fetch = spy as unknown as typeof fetch;
    return spy;
  }

  /** The nth fetch call's init object, typed. */
  function initOf(spy: jest.Mock<Promise<Response>, FetchCall>, call = 0): FetchCall[1] {
    return spy.mock.calls[call][1];
  }

  /** The multipart body of the nth fetch call. */
  function formOf(spy: jest.Mock<Promise<Response>, FetchCall>, call = 0): FormData {
    return initOf(spy, call).body;
  }

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  describe('configuration', () => {
    it('is not configured without a key', () => {
      expect(makeProvider({}).isConfigured()).toBe(false);
    });

    it('falls back to the shared GROQ_API_KEY', () => {
      expect(makeProvider({ GROQ_API_KEY: 'gsk_shared' }).isConfigured()).toBe(true);
    });

    it('prefers a dedicated STT key when one is set', async () => {
      const spy = mockFetch({});
      const provider = makeProvider({ GROQ_API_KEY: 'gsk_shared', GROQ_STT_API_KEY: 'gsk_stt' });

      await provider.transcribe(makeInput());

      expect(initOf(spy).headers.Authorization).toBe('Bearer gsk_stt');
    });

    it('treats a blank key as absent rather than sending "Bearer "', () => {
      expect(makeProvider({ GROQ_API_KEY: '   ' }).isConfigured()).toBe(false);
    });

    it('rejects a transcribe call when unconfigured instead of calling out', async () => {
      const spy = mockFetch({});

      await expect(makeProvider({}).transcribe(makeInput())).rejects.toThrow('GROQ_API_KEY is not configured');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('request shape', () => {
    it('posts to the documented transcriptions endpoint', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      expect(spy.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
      expect(initOf(spy).method).toBe('POST');
    });

    it('defaults to whisper-large-v3-turbo', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('model')).toBe('whisper-large-v3-turbo');
    });

    it('honours GROQ_STT_MODEL', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k', GROQ_STT_MODEL: 'whisper-large-v3' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('model')).toBe('whisper-large-v3');
    });

    it('does NOT read GROQ_MODEL — that is the chat model', async () => {
      const spy = mockFetch({});

      // Mirrors the real .env, where GROQ_MODEL=openai/gpt-oss-120b. Sending
      // that to an audio endpoint would 400 on every recording.
      await makeProvider({ GROQ_API_KEY: 'k', GROQ_MODEL: 'openai/gpt-oss-120b' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('model')).toBe('whisper-large-v3-turbo');
    });

    it('requests verbose_json so duration comes back', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('response_format')).toBe('verbose_json');
    });

    it('pins temperature to 0 so silence is not hallucinated into words', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('temperature')).toBe('0');
    });

    it('omits language when not hinted, so Whisper auto-detects', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      const form = formOf(spy);
      expect(form.get('language')).toBeNull();
    });

    it('passes a language hint through when given', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe({ ...makeInput(), language: 'en' });

      const form = formOf(spy);
      expect(form.get('language')).toBe('en');
    });

    it('sends the audio under the documented "file" field', async () => {
      const spy = mockFetch({});

      await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      const form = formOf(spy);
      const file = form.get('file');
      expect(file).toBeInstanceOf(Blob);
      expect((file as File).name).toBe('recording.m4a');
    });
  });

  describe('response handling', () => {
    it('returns the transcript, language and duration', async () => {
      mockFetch({ jsonBody: { text: 'build a todo app', language: 'english', duration: 4.2 } });

      const result = await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      expect(result).toEqual({ text: 'build a todo app', language: 'english', durationSeconds: 4.2 });
    });

    it('tolerates a json-only response with no language or duration', async () => {
      mockFetch({ jsonBody: { text: 'just text' } });

      const result = await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      expect(result).toEqual({ text: 'just text', language: undefined, durationSeconds: undefined });
    });

    it('preserves empty text rather than inventing content', async () => {
      // Silent audio is a legitimate 200. The service turns this into the
      // "we couldn't hear anything" message; the provider must not mask it.
      mockFetch({ jsonBody: { text: '' } });

      const result = await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      expect(result.text).toBe('');
    });

    it('rejects a response with no text field', async () => {
      mockFetch({ jsonBody: { error: 'nope' } });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow(
        'unexpected response shape',
      );
    });

    it('rejects a non-string text field', async () => {
      mockFetch({ jsonBody: { text: 12345 } });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow(
        'unexpected response shape',
      );
    });
  });

  describe('failures', () => {
    it.each([401, 413, 429, 500])('surfaces status %i as a TranscriptionHttpError', async (status) => {
      mockFetch({ ok: false, status, jsonBody: { error: 'x' } });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toMatchObject({
        name: 'TranscriptionHttpError',
        status,
      });
    });

    it('carries the provider name on the error for logs', async () => {
      mockFetch({ ok: false, status: 429, jsonBody: {} });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toBeInstanceOf(
        TranscriptionHttpError,
      );
    });

    it('does not retry an HTTP error — that would multiply quota usage', async () => {
      const spy = mockFetch({ ok: false, status: 500, jsonBody: {} });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 429 — the quota is already exhausted', async () => {
      const spy = mockFetch({ ok: false, status: 429, jsonBody: {} });

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    /** Mirrors Node: the real reason is on `cause.code`, not the message. */
    function connectError(code: string): Error {
      return Object.assign(new Error('fetch failed'), { cause: Object.assign(new Error(code), { code }) });
    }

    it('retries a DNS failure — the request never reached Groq, so it is free', async () => {
      // This is the failure actually observed in development: bursts of
      // EAI_AGAIN with the same request succeeding minutes later.
      const spy = jest
        .fn()
        .mockRejectedValueOnce(connectError('EAI_AGAIN'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ text: 'recovered' }),
          text: () => Promise.resolve('{}'),
        });
      global.fetch = spy as unknown as typeof fetch;

      const result = await makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput());

      expect(result.text).toBe('recovered');
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it.each(['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED'])('retries %s once', async (code) => {
      const spy = jest.fn().mockRejectedValue(connectError(code));
      global.fetch = spy as unknown as typeof fetch;

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow(
        /Could not reach the Groq transcription service/,
      );
      // One retry, then it gives up rather than hammering a dead network.
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('gives up after a single retry', async () => {
      const spy = jest.fn().mockRejectedValue(connectError('EAI_AGAIN'));
      global.fetch = spy as unknown as typeof fetch;

      await expect(makeProvider({ GROQ_API_KEY: 'k' }).transcribe(makeInput())).rejects.toThrow();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry a timeout — the audio may already be processing', async () => {
      // An aborted request may have reached Groq, so re-sending could be
      // billed twice. Distinct from a connect failure, which never arrived.
      const spy = jest.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })),
          );
        });
      });
      global.fetch = spy as unknown as typeof fetch;

      await expect(
        makeProvider({ GROQ_API_KEY: 'k', GROQ_STT_TIMEOUT_MS: '50' }).transcribe(makeInput()),
      ).rejects.toThrow(/timed out after 50ms/);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('wraps a network failure without leaking the key', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo EAI_AGAIN api.groq.com')) as never;

      await expect(makeProvider({ GROQ_API_KEY: 'gsk_secret' }).transcribe(makeInput())).rejects.toThrow(
        /Could not reach the Groq transcription service/,
      );
    });

    it('never includes the api key in an error message', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('socket hang up')) as never;

      // Asserted on the caught error rather than an asymmetric matcher so the
      // whole chain is checked: some runtimes attach request headers (and so
      // the key) to `cause`, which a message-only check would miss.
      let caught: unknown;
      try {
        await makeProvider({ GROQ_API_KEY: 'gsk_supersecret' }).transcribe(makeInput());
      } catch (error) {
        caught = error;
      }

      if (!(caught instanceof Error)) {
        throw new Error('expected the provider to throw an Error');
      }

      expect(JSON.stringify({ message: caught.message, stack: caught.stack })).not.toContain('gsk_supersecret');
    });
  });
});
