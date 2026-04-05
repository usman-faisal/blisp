import { Injectable } from '@nestjs/common';
import { User, ProjectStatus, BrainDumpStatus, TaskStatus, Prisma } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateBrainDumpDto } from './dto/create-brain-dump.dto';
import { AiService } from 'src/ai/ai.service';
import { BrainDumpExtractionSchema } from './types/schema';
import { BrainDumpResponse, ProgressUpdateResponse } from '@repo/types';
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

      const existingProjects = await this.prisma.project.findMany({
        where: { userId: user.id, status: { not: ProjectStatus.ARCHIVED } },
        select: { id: true, title: true, description: true, status: true },
      });

      const activeTasks = await this.prisma.task.findMany({
        where: {
          project: { userId: user.id },
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

      const promptContext =
        `Existing Projects:\n${JSON.stringify(existingProjects, null, 2)}\n\n` +
        `Active Tasks:\n${JSON.stringify(activeTasks, null, 2)}\n\n` +
        `User Transcript: "${rawTranscript}"\n`;

      const response = await this.aiService.generateStructuredData(
        promptContext,
        BrainDumpExtractionSchema,
        'BrainDump',
        BRAIN_DUMP_SYSTEM_PROMPT,
      );

      this.logger.log('Brain dump processed successfully for user:', user.id);

      let validTargetProjectId = response.targetProjectId;
      if (validTargetProjectId) {
        const exists = existingProjects.find(p => p.id === validTargetProjectId);
        if (!exists) {
          this.logger.warn(`AI provided invalid targetProjectId: ${validTargetProjectId}`);
          validTargetProjectId = null;
        }
      }

      switch (response.intent) {
        case 'PROGRESS_UPDATE':
          this.logger.log(`Detected PROGRESS_UPDATE for user ${user.id}. Processing directly.`);

          if (!response.targetTaskId || !response.newStatus) {
            this.logger.warn(`AI could not identify a valid task from PROGRESS_UPDATE.`);
            return {
              data: null,
              message: "I couldn't match your update to an existing task. Could you be more specific about what you accomplished?",
              success: false,
            };
          }

          const validTask = activeTasks.find((t) => t.id === response.targetTaskId);
          if (!validTask) {
            this.logger.error(`AI hallucinated targetTaskId: ${response.targetTaskId}`);
            return {
              data: null,
              message: "I couldn't confidently match your update to an existing task. Could you be more specific?",
              success: false,
            };
          }

          const updatedTask = await this.prisma.task.update({
            where: { id: response.targetTaskId },
            data: { status: response.newStatus as TaskStatus },
            include: { project: { select: { title: true } } },
          });

          await this.prisma.brainDump.update({
            where: { id: initialBrainDump.id },
            data: { status: BrainDumpStatus.PROCESSED, processedAt: new Date() },
          });

          this.logger.log(`Task "${updatedTask.title}" (${updatedTask.id}) updated to ${response.newStatus} for user ${user.id}.`);

          return {
            data: {
              taskId: updatedTask.id,
              taskTitle: updatedTask.title,
              projectTitle: updatedTask.project.title,
              newStatus: response.newStatus as TaskStatus,
            },
            message: response.acknowledgement || 'Progress updated safely!',
            success: true,
          };

        case 'ARCHIVE_PROJECT':
          if (validTargetProjectId) {
            await this.prisma.project.update({
              where: { id: validTargetProjectId },
              data: { status: ProjectStatus.ARCHIVED },
            });
          }
          break;

        case 'UPDATE_PROJECT':
          if (validTargetProjectId && response.projectUpdates) {
            const { title, description, techStack } = response.projectUpdates;
            const updatePayload: Prisma.ProjectUpdateInput = {};
            if (title) updatePayload.title = title;
            if (description) updatePayload.description = description;
            if (techStack && techStack.length > 0) updatePayload.techStack = techStack;

            if (Object.keys(updatePayload).length > 0) {
              await this.prisma.project.update({
                where: { id: validTargetProjectId },
                data: updatePayload,
              });
            }
          }
          break;

        case 'APPEND_NOTE':
        case 'CREATE_PROJECT':
        default:
          break;
      }

      const updateData: any = {
        status: BrainDumpStatus.PROCESSED,
        processedAt: new Date(),
      };

      if (response.intent === 'CREATE_PROJECT') {
        updateData.projects = {
          create: {
            userId: user.id,
            title: response.title,
            description: response.summary,
            classification: response.classification,
            status: response.suggestedStatus,
            techStack: response.techStack,
          },
        };
      } else if (validTargetProjectId) {
        updateData.projects = {
          connect: { id: validTargetProjectId },
        };
      }

      const processedBrainDump = await this.prisma.brainDump.update({
        where: { id: initialBrainDump.id },
        data: updateData,
        include: {
          projects: {
            include: {
              tasks: true,
            },
          },
        },
      });

      const project = processedBrainDump.projects[0];

      if (response.intent === 'CREATE_PROJECT' && project) {
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
}
