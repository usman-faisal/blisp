import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoOutputGeneratedError, generateText, LanguageModel, Output } from 'ai';
import { TavilyResult } from 'src/common/types/type';
import { ZodType } from 'zod';

@Injectable()
export class AiService {
  private logger = new Logger(AiService.name);
  private readonly model: LanguageModel;
  /**
   * Retries transport failures (429, 5xx, timeouts) — not schema-validation
   * failures, which would just ask the same model the same question. Free tiers
   * rate-limit, so 0 means a single 429 kills the whole brain dump.
   */
  private readonly maxRetries: number;

  /**
   * Provider-specific request options, set once at boot. Chiefly reasoning
   * effort — see the note in the constructor.
   */
  private readonly providerOptions?: Record<string, Record<string, string>>;

  /**
   * The selected model's id, for recording which model produced a stored
   * artefact (e.g. a research report version). Read off the model itself so it
   * cannot drift from what is actually in use.
   */
  get modelId(): string {
    return typeof this.model === 'string' ? this.model : this.model.modelId;
  }

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>('AI_PROVIDER');

    // Blank or non-numeric falls back to the default rather than to 0, since
    // Number('') is 0 and would silently disable retries.
    const configuredRetries = Number(this.configService.get<string>('AI_MAX_RETRIES')?.trim() || NaN);
    this.maxRetries = Number.isInteger(configuredRetries) && configuredRetries >= 0 ? configuredRetries : 2;

    if (provider === 'github') {
      const GITHUB_TOKEN = this.configService.get<string>('GITHUB_TOKEN');
      if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is not set in the environment variables');
      }

      const githubModels = createOpenAICompatible({
        name: 'github-models',
        baseURL: 'https://models.github.ai/inference',
        apiKey: GITHUB_TOKEN,
        supportsStructuredOutputs: true,
      });

      // Configurable because providers retire model ids: GitHub Models pulled
      // several mid-project, and a hardcoded id means a code change to recover.
      this.model = githubModels(this.configService.get<string>('GITHUB_MODEL') ?? 'openai/gpt-4o-mini');
    }

    if (provider === 'openrouter') {
      const OPENROUTER_API_KEY = this.configService.get<string>('OPENROUTER_API_KEY');
      if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set in the environment variables');
      }

      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: OPENROUTER_API_KEY,
        supportsStructuredOutputs: true,
      });

      // No default: OpenRouter serves hundreds of models and its free tier
      // rotates, so guessing an id here would be a fallback that breaks
      // silently. Better to fail at boot with a message naming the variable.
      const OPENROUTER_MODEL = this.configService.get<string>('OPENROUTER_MODEL')?.trim();
      if (!OPENROUTER_MODEL) {
        throw new Error(
          'OPENROUTER_MODEL is not set. Pick one from openrouter.ai/models — it must ' +
            'support structured outputs, since every call here is schema-constrained.',
        );
      }

      this.model = openrouter(OPENROUTER_MODEL);
    }

    if (provider === 'groq') {
      const GROQ_API_KEY = this.configService.get<string>('GROQ_API_KEY');
      if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set in the environment variables');
      }

      const groq = createOpenAICompatible({
        name: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: GROQ_API_KEY,
        supportsStructuredOutputs: true,
      });

      // Defaults to gpt-oss-120b because it is one of the few free-tier models
      // with *strict* JSON-schema mode, which every call here depends on.
      // Models without it fall back to best-effort JSON and fail validation
      // intermittently — worse than failing outright.
      this.model = groq(this.configService.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b');
    }

    if (provider === 'gemini') {
      const GEMINI_API_KEY = this.configService.get<string>('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in the environment variables');
      }
      const geminiModels = createGoogleGenerativeAI({
        apiKey: GEMINI_API_KEY,
      });
      this.model = geminiModels(this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash-lite');
    }

    // Without this, an unset or misspelled AI_PROVIDER leaves this.model
    // undefined and the failure surfaces much later, inside a queue job, as a
    // confusing error rather than at boot.
    if (!this.model) {
      throw new Error(
        `AI_PROVIDER must be "github", "gemini", "openrouter" or "groq" (received: ${provider ?? 'unset'}).`,
      );
    }

    // Groq's gpt-oss models are reasoning models: they spend part of the output
    // budget on hidden reasoning tokens before emitting any JSON. Measured at
    // default effort that was 1,129 tokens of a 4,000 budget, and on a longer
    // run it consumed the whole allowance and returned no document at all
    // ("No output generated"). At "low" it drops to ~359 tokens AND produces
    // more actual content, so this is both more reliable and more useful.
    //
    // Provider-scoped because the key is only meaningful to an
    // OpenAI-compatible provider that supports it; Gemini ignores it.
    this.providerOptions =
      provider === 'groq' || provider === 'github' || provider === 'openrouter'
        ? { [provider]: { reasoningEffort: this.configService.get<string>('AI_REASONING_EFFORT') ?? 'low' } }
        : undefined;

    // Read back off the model rather than repeating the fallback ids above, so
    // this cannot drift from what was actually selected. Otherwise the only
    // place the model id appears is in the request URL of a failure.
    this.logger.log(
      `AI provider "${provider}" using model "${typeof this.model === 'string' ? this.model : this.model.modelId}" (maxRetries: ${this.maxRetries})`,
    );
  }

  async generateStructuredData<T>(
    prompt: string,
    schema: ZodType<T>,
    schemaName: string,
    systemPrompt?: string,
    /**
     * Output allowance. Worth setting for any schema large enough that the
     * response could be truncated: providers may otherwise clamp the limit to
     * whatever is left in the rate-limit window, and a document cut off
     * mid-field fails schema validation with a non-retryable error.
     */
    maxOutputTokens?: number,
  ): Promise<T> {
    // One in-process retry for an empty response.
    //
    // A reasoning model's hidden reasoning competes with the document for the
    // output budget, and its length varies between otherwise identical runs: an
    // observed run spent 1,129 tokens reasoning and succeeded, while another
    // consumed the whole allowance and returned nothing. The AI SDK's own
    // `maxRetries` does not cover this, because the HTTP call succeeded — the
    // response was simply empty — so without this a normal run-to-run variation
    // loses a report that cost four web searches to assemble.
    const attempts = 2;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await generateText({
          model: this.model,
          prompt,
          output: Output.object({ schema, name: schemaName }),
          system: systemPrompt,
          maxRetries: this.maxRetries,
          maxOutputTokens,
          providerOptions: this.providerOptions,
        });
        return response.output;
      } catch (error) {
        // The SDK's own type guard, rather than matching on error.name.
        const isEmptyOutput = NoOutputGeneratedError.isInstance(error);

        if (isEmptyOutput && attempt < attempts) {
          this.logger.warn(`${schemaName}: model returned no output, retrying (attempt ${attempt + 1}/${attempts})`);
          continue;
        }

        this.logger.error(`Error generating ${schemaName}:`, error);
        throw new InternalServerErrorException('Failed to generate structured data');
      }
    }

    // Unreachable: the loop either returns or throws.
    throw new InternalServerErrorException('Failed to generate structured data');
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await generateText({
        model: this.model,
        prompt,
        providerOptions: this.providerOptions,
      });
      return response.text;
    } catch (error) {
      console.error('Error generating text:', error);
      throw new InternalServerErrorException('Failed to generate text');
    }
  }

  async search(query: string, depth: 'basic' | 'advanced' = 'basic'): Promise<TavilyResult[]> {
    const TAVILY_API_KEY = this.configService.get<string>('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) {
      console.warn('TAVILY_API_KEY is not set. Skipping search.');
      return [];
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: depth,
          include_answer: false,
          max_results: depth === 'advanced' ? 5 : 3,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Tavily returned ${response.status} for query: "${query}"`);
        return [];
      }

      // Narrowed rather than trusted: response.json() is `any`, and callers
      // index into .url/.title, so a shape change would surface as a crash
      // deep in a queue job instead of an empty result set here.
      const data = (await response.json()) as { results?: TavilyResult[] } | null;
      return data?.results ?? [];
    } catch (error) {
      console.error('Tavily Search Error:', error);
      return [];
    }
  }

  /**
   * Like `search`, but says whether the call actually failed.
   *
   * `search` collapses "the search worked and found nothing" and "the search
   * could not be reached" into the same empty array. For a report whose whole
   * value is its evidence that distinction matters: a transient DNS failure
   * (EAI_AGAIN) once produced a report with zero sources that was saved as a
   * normal draft, indistinguishable from a properly sourced one.
   *
   * Kept as a separate method so the existing callers, where an empty result is
   * genuinely harmless, keep their current behaviour.
   */
  async searchWithStatus(
    query: string,
    depth: 'basic' | 'advanced' = 'basic',
  ): Promise<{ results: TavilyResult[]; failed: boolean }> {
    const TAVILY_API_KEY = this.configService.get<string>('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) {
      this.logger.warn('TAVILY_API_KEY is not set. Skipping search.');
      return { results: [], failed: true };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: depth,
          include_answer: false,
          max_results: depth === 'advanced' ? 5 : 3,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Tavily returned ${response.status} for query: "${query}"`);
        return { results: [], failed: true };
      }

      const data = (await response.json()) as { results?: TavilyResult[] } | null;
      // An empty result set from a 200 is a real answer, not a failure.
      return { results: data?.results ?? [], failed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Tavily search failed for "${query}": ${message}`);
      return { results: [], failed: true };
    }
  }
}
