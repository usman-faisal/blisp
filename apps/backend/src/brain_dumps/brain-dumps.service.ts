import { Injectable } from '@nestjs/common';
import { User, Status } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateBrainDumpDto } from './dto/create-brain-dump.dto';
import { AiService } from 'src/ai/ai.service';
import { BrainDumpExtractionSchema } from './types/schema';
import { BRAIN_DUMP_SYSTEM_PROMPT } from 'src/common/prompts/brain_dump.prompt';
import { throwError } from 'src/common/utils/helpers';

@Injectable()
export class BrainDumpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async createBrainDump(user: User, createBrainDumpDto: CreateBrainDumpDto) {
    const { prompt: rawTranscript } = createBrainDumpDto;

    const initialBrainDump = await this.prisma.brainDump.create({
      data: {
        userId: user.id,
        rawTranscript,
      },
    });

    try {
      const response = await this.aiService.generateStructuredData(
        rawTranscript,
        BrainDumpExtractionSchema,
        'DeveloperBrainDump',
        BRAIN_DUMP_SYSTEM_PROMPT,
      );

      const processedBrainDump = await this.prisma.brainDump.update({
        where: { id: initialBrainDump.id },
        data: {
          processedAt: new Date(),
          projects: {
            create: {
              userId: user.id,
              title: response.title,
              description: response.summary,
              classification: response.classification,
              status: response.suggestedStatus,
              techStack: response.techStack,

              tasks: {
                create: response.technicalSteps.map((step) => ({
                  title: step,
                  status: 'TODO',
                })),
              },
            },
          },
        },
        include: {
          projects: {
            include: {
              tasks: true,
            },
          },
        },
      });
      if (response.suggestedStatus === Status.INCUBATOR) {
        // register an event
      }

      return processedBrainDump;
    } catch (error) {
      console.error('LLM Processing Error for Brain Dump:', error);
      throwError(
        'Your brain dump was saved, but we encountered an error generating the action plan. We will try again later.',
      );
    }
  }
}
