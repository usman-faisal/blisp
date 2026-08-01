import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectStatus, TaskStatus, Prisma } from '@repo/db';
import { ActivateProjectResponse, ArchiveProjectResponse, GetProjectsResponse, GetProjectDetailResponse, GetProjectStatsResponse, GetProjectProgressResponse, UpdateProjectResponse } from '@repo/types';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';
import { ProjectAccessService } from './project-access.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyPlanCronService: DailyPlanCronService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Promotes a project from INCUBATOR → ACTIVE.
   * The existing hourly cron will pick up its tasks automatically.
   */
  async activateProject(userId: string, projectId: string): Promise<ActivateProjectResponse> {
    // Throws NotFound for non-members, so the lookup below no longer needs to
    // filter on userId.
    await this.access.assertMember(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
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
    // Archiving hides the project from every member, so it stays owner-only.
    await this.access.assertOwner(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
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
    // Any member may edit the shared roadmap's title, description and stack.
    await this.access.assertMember(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
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
    // Every project the user belongs to, not only the ones they created.
    // An empty list scopes this to nothing, which is the safe direction.
    const projectIds = await this.access.memberProjectIds(userId);

    const projects = await this.prisma.project.findMany({
      where: {
        id: { in: projectIds },
        ...(status && { status }),
      },
      include: {
        resources: true,
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: projects.map(p => {
        const todo = p.tasks.filter(t => t.status === TaskStatus.TODO).length;
        const inProgress = p.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
        const done = p.tasks.filter(t => t.status === TaskStatus.DONE).length;

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          techStack: p.techStack,
          status: p.status,
          classification: p.classification,
          resources: p.resources,
          taskCounts: { todo, inProgress, done, total: todo + inProgress + done },
        };
      }),
      message: 'Projects retrieved successfully.',
      success: true,
    };
  }

  async getProjectById(userId: string, projectId: string): Promise<GetProjectDetailResponse> {
    await this.access.assertMember(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        resources: true,
        tasks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            status: true,
            plannedFor: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    return {
      data: {
        id: project.id,
        title: project.title,
        description: project.description,
        techStack: project.techStack,
        classification: project.classification,
        status: project.status,
        resources: project.resources,
        tasks: project.tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          plannedFor: t.plannedFor ? t.plannedFor.toISOString().split('T')[0] : null,
          createdAt: t.createdAt.toISOString(),
        })),
      },
      message: 'Project retrieved successfully.',
      success: true,
    };
  }

  /**
   * Overall and per-member completion for a shared project.
   *
   * Aggregated in the database rather than by loading tasks into memory: this
   * is called on every roadmap view, and a project can hold hundreds of tasks.
   */
  async getProjectProgress(
    userId: string,
    projectId: string,
  ): Promise<GetProjectProgressResponse> {
    await this.access.assertMember(userId, projectId);

    const [byStatus, byAssignee, members] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId', 'status'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { name: true } } },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      }),
    ]);

    const countFor = (status: TaskStatus) =>
      byStatus.find((row) => row.status === status)?._count.id ?? 0;

    const done = countFor(TaskStatus.DONE);
    const inProgress = countFor(TaskStatus.IN_PROGRESS);
    const todo = countFor(TaskStatus.TODO);
    const total = done + inProgress + todo;

    const perMember = members.map((member) => {
      const rows = byAssignee.filter((row) => row.assigneeId === member.userId);
      const forStatus = (status: TaskStatus) =>
        rows.find((row) => row.status === status)?._count.id ?? 0;

      const memberDone = forStatus(TaskStatus.DONE);
      const memberInProgress = forStatus(TaskStatus.IN_PROGRESS);
      const memberTodo = forStatus(TaskStatus.TODO);

      return {
        userId: member.userId,
        name: member.user.name,
        role: member.role,
        assigned: memberDone + memberInProgress + memberTodo,
        done: memberDone,
        inProgress: memberInProgress,
        todo: memberTodo,
      };
    });

    const unassigned = byAssignee
      .filter((row) => row.assigneeId === null)
      .reduce((sum, row) => sum + row._count.id, 0);

    return {
      data: {
        overall: {
          total,
          done,
          inProgress,
          todo,
          // Guard the divide: a project with no tasks is 0% complete, not NaN.
          percentComplete: total === 0 ? 0 : Math.round((done / total) * 100),
        },
        perMember,
        unassigned,
      },
      message: 'Project progress retrieved successfully.',
      success: true,
    };
  }

  async getProjectStats(userId: string): Promise<GetProjectStatsResponse> {
    const projectIds = await this.access.memberProjectIds(userId);

    const stats = await this.prisma.project.groupBy({
      by: ['status'],
      where: { id: { in: projectIds } },
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
