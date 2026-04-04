import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, LanguageModel, Output } from 'ai';
import { ZodType } from 'zod';

@Injectable()
export class AiService {
  private readonly model: LanguageModel;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>('AI_PROVIDER');

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

      this.model = githubModels('openai/gpt-4o-mini');
    }

    if (provider === 'gemini') {
      const GEMINI_API_KEY = this.configService.get<string>('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not set in the environment variables');
      }
      const geminiModels = createGoogleGenerativeAI({
        apiKey: GEMINI_API_KEY,
      })
      this.model = geminiModels('gemini-2.0-flash-lite')
    }
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
        maxRetries: 0,
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

  async search(query: string): Promise<any[]> {
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
          search_depth: 'advanced',
          include_answer: true,
          max_results: 5,
        }),
      });

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Tavily Search Error:', error);
      return [];
    }
  }
}
