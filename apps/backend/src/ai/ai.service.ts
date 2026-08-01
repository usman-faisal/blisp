import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, LanguageModel, Output } from 'ai';
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

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>('AI_PROVIDER');

    // Blank or non-numeric falls back to the default rather than to 0, since
    // Number('') is 0 and would silently disable retries.
    const configuredRetries = Number(
      this.configService.get<string>('AI_MAX_RETRIES')?.trim() || NaN,
    );
    this.maxRetries = Number.isInteger(configuredRetries) && configuredRetries >= 0
      ? configuredRetries
      : 2;

    if (provider === 'github') {
      const GITHUB_TOKEN = this.configService.get<string>('GITHUB_TOKEN');
      if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is not set in the environment variables');
      }

      const githubModels = createOpenAICompatible({
        name: 'github-models',
        baseURL: 'https://models.github.ai/inference',
        apiKey: GITHUB_TOKEN,
        supportsStructuredOutputs: true
      });

      // Configurable because providers retire model ids: GitHub Models pulled
      // several mid-project, and a hardcoded id means a code change to recover.
      this.model = githubModels(
        this.configService.get<string>('GITHUB_MODEL') ?? 'openai/gpt-4o-mini',
      );
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

    if (provider === 'gemini') {
      const GEMINI_API_KEY = this.configService.get<string>('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in the environment variables');
      }
      const geminiModels = createGoogleGenerativeAI({
        apiKey: GEMINI_API_KEY,
      })
      this.model = geminiModels(
        this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash-lite',
      );
    }

    // Without this, an unset or misspelled AI_PROVIDER leaves this.model
    // undefined and the failure surfaces much later, inside a queue job, as a
    // confusing error rather than at boot.
    if (!this.model) {
      throw new Error(
        `AI_PROVIDER must be "github", "gemini" or "openrouter" (received: ${provider ?? 'unset'}).`,
      );
    }

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
  ): Promise<T> {
    try {
      const response = await generateText({
        model: this.model,
        prompt,
        output: Output.object({ schema, name: schemaName }),
        system: systemPrompt,
        maxRetries: this.maxRetries,
      });
      return response.output;
    } catch (error) {
      console.error('Error generating structured data:', error);
      throw new InternalServerErrorException('Failed to generate structured data');
    }
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const response = await generateText({
        model: this.model,
        prompt,
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

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Tavily Search Error:', error);
      return [];
    }
  }
}
