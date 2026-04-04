import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectStatus } from '@repo/db';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promotes a project from INCUBATOR → ACTIVE.
   * The existing hourly cron will pick up its tasks automatically.
   */
  async activateProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found. Please check the ID and make sure you own this project.',
      );
    }

    if (project.status === ProjectStatus.ACTIVE) {
      this.logger.verbose(`Project ${projectId} is already ACTIVE. No-op.`);
      return {
        data: project,
        message: 'This project is already active.',
        success: true,
      };
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ACTIVE },
      include: { tasks: { select: { id: true, title: true, status: true } } },
    });

    this.logger.log(
      `Project "${updatedProject.title}" (${projectId}) promoted to ACTIVE for user ${userId}.`,
    );

    return {
      data: updatedProject,
      message:
        'Project activated. Its tasks will be scheduled in your next daily plan.',
      success: true,
    };
  }
}
