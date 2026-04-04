import { Injectable } from '@nestjs/common';
import { User, ProjectStatus, BrainDumpStatus, TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateBrainDumpDto } from './dto/create-brain-dump.dto';
import { AiService } from 'src/ai/ai.service';
import { BrainDumpExtractionSchema, TaskUpdateSchema } from './types/schema';
import { BrainDumpResponse, ProgressUpdateResponse } from '@repo/types';
import { BRAIN_DUMP_SYSTEM_PROMPT } from 'src/common/prompts/brain-dump.prompt';
import { PROGRESS_UPDATE_SYSTEM_PROMPT } from 'src/common/prompts/progress-update.prompt';
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
  ) { }

  async createBrainDump(
    user: User, 
    createBrainDumpDto: CreateBrainDumpDto
  ): Promise<BrainDumpResponse | ProgressUpdateResponse> {
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
        rawTranscript,
        BrainDumpExtractionSchema,
        'BrainDump',
        BRAIN_DUMP_SYSTEM_PROMPT,
      );

      this.logger.log('Brain dump processed successfully for user:', user.id);

      if (response.classification === 'PROGRESS_UPDATE') {
        this.logger.log(`Detected PROGRESS_UPDATE for user ${user.id}. Diverting to task matcher.`);

        await this.prisma.brainDump.update({
          where: { id: initialBrainDump.id },
          data: { status: BrainDumpStatus.PROCESSED, processedAt: new Date() },
        });

        return this.handleProgressUpdate(user.id, rawTranscript);
      }

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
            include: {
              tasks: true,
            },
          },
        },
      })

      this.logger.log('Brain dump processed successfully for user:', user.id);

      const project = processedBrainDump.projects[0];

      if (project) {
        this.logger.log(`Registering research job for ${project.status} project: ${project.id}`);
        await this.incubatorQueue.add(JOBS.RESEARCH, {
          projectId: project.id,
          userId: user.id,
          title: project.title,
          summary: project.description,
          techStack: project.techStack,
          rawTranscript: initialBrainDump.rawTranscript,
        });
      }

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

  private async handleProgressUpdate(
    userId: string, 
    rawTranscript: string
  ): Promise<ProgressUpdateResponse> {
    const activeTasks = await this.prisma.task.findMany({
      where: {
        project: { userId },
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        project: { select: { title: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (activeTasks.length === 0) {
      this.logger.warn(`User ${userId} reported progress but has no active tasks.`);
      return {
        data: null,
        message: "You don't have any active tasks right now. Try creating a new brain dump first!",
        success: false,
      };
    }

    const taskContext = activeTasks.map((t) => ({
      id: t.id,
      title: t.title,
      projectTitle: t.project.title,
      status: t.status,
    }));

    const prompt =
      `Active Tasks:\n${JSON.stringify(taskContext, null, 2)}\n\n` +
      `User Transcript: "${rawTranscript}"\n\n` +
      `Which task is the user referring to? Return the matching task ID, new status, and a short acknowledgement.`;

    const result = await this.aiService.generateStructuredData(
      prompt,
      TaskUpdateSchema,
      'TaskUpdate',
      PROGRESS_UPDATE_SYSTEM_PROMPT,
    );

    if (!result.taskId) {
      this.logger.warn(`AI could not match transcript to a task for user ${userId}.`);
      return {
        data: null,
        message:
          "I couldn't find a task matching that description. Could you be more specific about which task you're updating?",
        success: false,
      };
    }

    const targetTask = activeTasks.find((t) => t.id === result.taskId);
    if (!targetTask) {
      this.logger.error(
        `AI returned taskId ${result.taskId} which is not in the user's active task list. Possible hallucination.`,
      );
      return {
        data: null,
        message:
          "I couldn't confidently match your update to an existing task. Could you be more specific?",
        success: false,
      };
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: result.taskId },
      data: { status: result.newStatus as TaskStatus },
      include: { project: { select: { title: true } } },
    });

    this.logger.log(
      `Task "${updatedTask.title}" (${updatedTask.id}) updated to ${result.newStatus} for user ${userId}.`,
    );

    return {
      data: {
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        projectTitle: updatedTask.project.title,
        newStatus: result.newStatus,
      },
      message: result.acknowledgement,
      success: true,
    };
  }
}
