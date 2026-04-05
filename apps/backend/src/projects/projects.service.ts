import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectStatus } from '@repo/db';
import { ActivateProjectResponse, GetProjectsResponse, GetProjectStatsResponse } from '@repo/types';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promotes a project from INCUBATOR → ACTIVE.
   * The existing hourly cron will pick up its tasks automatically.
   */
  async activateProject(userId: string, projectId: string): Promise<ActivateProjectResponse> {
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
        data: { id: project.id, status: project.status },
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
      data: { id: updatedProject.id, status: updatedProject.status },
      message:
        'Project activated. Its tasks will be scheduled in your next daily plan.',
      success: true,
    };
  }

  async getProjects(userId: string, status?: ProjectStatus): Promise<GetProjectsResponse> {
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      include: {
        resources: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: projects.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        techStack: p.techStack,
        status: p.status,
        classification: p.classification,
        resources: p.resources,
      })),
      message: 'Projects retrieved successfully.',
      success: true,
    };
  }

  async getProjectStats(userId: string): Promise<GetProjectStatsResponse> {
    const stats = await this.prisma.project.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        id: true,
      },
    });

    const counts = {
      activeCount: 0,
      incubatingCount: 0,
      completedCount: 0,
    };

    stats.forEach(stat => {
      if (stat.status === ProjectStatus.ACTIVE) counts.activeCount = stat._count.id;
      if (stat.status === ProjectStatus.INCUBATOR) counts.incubatingCount = stat._count.id;
      if (stat.status === ProjectStatus.ARCHIVED) counts.completedCount = stat._count.id;
    });

    return {
      data: counts,
      success: true,
      message: 'Project stats retrieved successfully.',
    };
  }
}
