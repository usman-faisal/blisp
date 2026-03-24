import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, Output } from 'ai';
import { ZodType } from 'zod';

@Injectable()
export class AiService {
  private google: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(private readonly configService: ConfigService) {
    const GEMINI_API_KEY = this.configService.get<string>('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in the environment variables');
    }
    this.google = createGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
    });
  }

  async generateStructuredData<T>(
    prompt: string,
    schema: ZodType<T>,
    schemaName: string,
    systemPrompt?: string,
  ): Promise<T> {
    try {
      const response = await generateText({
        model: this.google('gemini-2.0-flash-001'),
        prompt: prompt,
        output: Output.object({ schema, name: schemaName }),
        system: systemPrompt,
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
        model: this.google('gemini-2.0-flash-001'),
        prompt: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Error generating text:', error);
      throw new InternalServerErrorException('Failed to generate text');
    }
  }
}
