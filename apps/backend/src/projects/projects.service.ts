import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectStatus, Prisma } from '@repo/db';
import { ActivateProjectResponse, ArchiveProjectResponse, GetProjectsResponse, GetProjectStatsResponse, UpdateProjectResponse } from '@repo/types';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPlanCronService: DailyPlanCronService,
  ) {}

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

    // Fire daily plan immediately so tasks appear without waiting for the hourly cron
    this.dailyPlanCronService.processUserPlan(userId).catch((err) =>
      this.logger.error('processUserPlan failed after project activation', err),
    );

    return {
      data: { id: updatedProject.id, status: updatedProject.status },
      message:
        'Project activated. Its tasks will be scheduled in your next daily plan.',
      success: true,
    };
  }

  async archiveProject(userId: string, projectId: string): Promise<ArchiveProjectResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found or you do not own it.');
    }

    if (project.status === ProjectStatus.ARCHIVED) {
      return {
        data: { id: project.id, status: project.status },
        message: 'This project is already archived.',
        success: true,
      };
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED },
    });

    this.logger.log(`Project "${updated.title}" (${projectId}) archived for user ${userId}.`);

    return {
      data: { id: updated.id, status: updated.status },
      message: 'Project archived successfully.',
      success: true,
    };
  }

  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto): Promise<UpdateProjectResponse> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found or you do not own it.');
    }

    const updatePayload: Prisma.ProjectUpdateInput = {};
    if (dto.title) updatePayload.title = dto.title;
    if (dto.description) updatePayload.description = dto.description;
    if (dto.techStack && dto.techStack.length > 0) updatePayload.techStack = dto.techStack;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: updatePayload,
    });

    this.logger.log(`Project "${updated.title}" (${projectId}) updated for user ${userId}.`);

    return {
      data: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        techStack: updated.techStack,
      },
      message: 'Project updated successfully.',
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
