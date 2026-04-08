import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { GetProjectPipelineResponse } from '@repo/types';

@Injectable()
export class PipelineEventsService {
  private readonly logger = new Logger(PipelineEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs a pipeline stage event for a project.
   */
  async emit(
    projectId: string,
    stage: PipelineStage,
    message?: string,
  ): Promise<void> {
    await this.prisma.projectEvent.create({
      data: { projectId, stage, message },
    });
    this.logger.verbose(`Pipeline [${projectId}]: ${stage} — ${message ?? ''}`);
  }

  /**
   * Returns all pipeline events for a project, ordered chronologically.
   */
  async getProjectPipeline(
    userId: string,
    projectId: string,
  ): Promise<GetProjectPipelineResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, title: true },
    });

    if (!project) {
      return {
        data: { projectId, projectTitle: '', events: [] },
        message: 'Project not found.',
        success: false,
      };
    }

    const events = await this.prisma.projectEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: {
        projectId: project.id,
        projectTitle: project.title,
        events: events.map((e) => ({
          id: e.id,
          stage: e.stage,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
      },
      message: 'Pipeline events retrieved.',
      success: true,
    };
  }
}
