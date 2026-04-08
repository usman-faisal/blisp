import { Injectable } from '@nestjs/common';
import { User, ProjectStatus, BrainDumpStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateBrainDumpDto } from './dto/create-brain-dump.dto';
import { AiService } from 'src/ai/ai.service';
import { BrainDumpExtractionSchema } from './types/schema';
import { BrainDumpResponse } from '@repo/types';
import { BRAIN_DUMP_SYSTEM_PROMPT } from 'src/common/prompts/brain-dump.prompt';
import { throwError } from 'src/common/utils/helpers';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOBS, QUEUES } from 'src/common/lib/constants';

@Injectable()
export class BrainDumpsService {
  private readonly logger = new Logger(BrainDumpsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) {}

  async createBrainDump(
    user: User,
    createBrainDumpDto: CreateBrainDumpDto,
  ): Promise<BrainDumpResponse> {
    const { prompt: rawTranscript } = createBrainDumpDto;

    const initialBrainDump = await this.prisma.brainDump.create({
      data: {
        userId: user.id,
        rawTranscript,
      },
    });

    try {
      this.logger.log('Processing brain dump for user:', user.id);

      const response = await this.aiService.generateStructuredData(
        `User Transcript: "${rawTranscript}"`,
        BrainDumpExtractionSchema,
        'BrainDump',
        BRAIN_DUMP_SYSTEM_PROMPT,
      );

      this.logger.log('Brain dump processed successfully for user:', user.id);

      const processedBrainDump = await this.prisma.brainDump.update({
        where: { id: initialBrainDump.id },
        data: {
          status: BrainDumpStatus.PROCESSED,
          processedAt: new Date(),
          projects: {
            create: {
              userId: user.id,
              title: response.title,
              description: response.summary,
              classification: response.classification,
              status: response.suggestedStatus,
              techStack: response.techStack,
            },
          },
        },
        include: {
          projects: {
            include: { tasks: true },
          },
        },
      });

      const project = processedBrainDump.projects[0];

      this.logger.log(`Registering research job for ${project.status} project: ${project.id}`);
      await this.incubatorQueue.add(JOBS.RESEARCH, {
        projectId: project.id,
        userId: user.id,
        title: project.title,
        summary: project.description,
        techStack: project.techStack,
        rawTranscript: initialBrainDump.rawTranscript,
      });

      return {
        data: {
          id: processedBrainDump.id,
          rawTranscript: processedBrainDump.rawTranscript,
          processedAt: processedBrainDump.processedAt?.toISOString() || null,
          projects: processedBrainDump.projects.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            classification: p.classification,
            status: p.status,
            techStack: p.techStack,
            tasks: p.tasks.map(t => ({
              id: t.id,
              title: t.title,
              status: t.status,
            })),
          })),
        },
        message: 'Brain dump processed successfully',
        success: true,
      };
    } catch (error) {
      console.error('LLM Processing Error for Brain Dump:', error);

      await this.prisma.brainDump.update({
        where: { id: initialBrainDump.id },
        data: { status: BrainDumpStatus.FAILED },
      });

      throwError(
        'Your brain dump was saved, but we encountered an error generating the action plan. We will try again later.',
      );
    }
  }
}
