import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MilestoneStatus, Prisma, TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { ProgressTask, dailyCompletion, summarizeProgress } from './progress';
import { EXCLUDED_FROM_PROGRESS } from './roadmap.constants';
import { SchedulableTask, ScheduleFit, assessSchedule } from './scheduler';

/** Fields every progress calculation reads. */
const PROGRESS_SELECT = { status: true, effort: true } as const;

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Saves the planning inputs: deadline, hours, working days, skill level.
   *
   * Separate from generating the roadmap so a user can adjust their
   * availability and immediately see the effect on fit, without regenerating
   * tasks or touching completed work.
   */
  async updateSettings(
    userId: string,
    projectId: string,
    settings: {
      deadline?: string | null;
      hoursPerDay?: number | null;
      workingDays?: number[];
      skillLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
    },
  ) {
    await this.access.assertMember(userId, projectId);

    const data: Prisma.ProjectUpdateInput = {};

    if (settings.deadline !== undefined) {
      if (settings.deadline === null) {
        data.deadline = null;
      } else {
        const parsed = new Date(settings.deadline);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('deadline must be a valid date.');
        }
        data.deadline = parsed;
      }
    }

    if (settings.hoursPerDay !== undefined) {
      data.hoursPerDay = settings.hoursPerDay;
    }

    if (settings.workingDays !== undefined) {
      // Deduplicated and sorted so [5,1,1] and [1,5] are stored identically.
      const unique = [...new Set(settings.workingDays)].sort((a, b) => a - b);
      data.workingDays = unique;
    }

    if (settings.skillLevel !== undefined) {
      data.skillLevel = settings.skillLevel;
    }

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data,
      select: {
        id: true,
        deadline: true,
        hoursPerDay: true,
        workingDays: true,
        skillLevel: true,
        roadmapPlannedAt: true,
      },
    });

    return project;
  }

  /**
   * The roadmap: milestones, their tasks, progress at every level, and the
   * schedule assessment.
   *
   * One call rather than several because the figures must agree with each
   * other — fetching milestone progress and overall progress separately would
   * let them disagree mid-update.
   */
  async getRoadmap(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        deadline: true,
        hoursPerDay: true,
        workingDays: true,
        skillLevel: true,
        roadmapPlannedAt: true,
        milestones: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            status: true,
            targetDate: true,
            tasks: {
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                title: true,
                status: true,
                effort: true,
                priority: true,
                acceptanceCriteria: true,
                plannedFor: true,
                completedAt: true,
                assigneeId: true,
                assigneeName: true,
              },
            },
          },
        },
        tasks: {
          where: { milestoneId: null },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            status: true,
            effort: true,
            priority: true,
            acceptanceCriteria: true,
            plannedFor: true,
            completedAt: true,
            assigneeId: true,
            assigneeName: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    const allTasks = [...project.milestones.flatMap((m) => m.tasks), ...project.tasks];

    const schedule = assessSchedule({
      tasks: allTasks as SchedulableTask[],
      deadline: project.deadline,
      hoursPerDay: project.hoursPerDay,
      workingDays: project.workingDays,
      skillLevel: project.skillLevel,
      from: new Date(),
    });

    return {
      projectId: project.id,
      projectTitle: project.title,
      settings: {
        deadline: project.deadline,
        hoursPerDay: project.hoursPerDay,
        workingDays: project.workingDays,
        skillLevel: project.skillLevel,
        roadmapPlannedAt: project.roadmapPlannedAt,
      },
      milestones: project.milestones.map((m) => ({
        ...m,
        progress: summarizeProgress(m.tasks as ProgressTask[]),
      })),
      /** Tasks not yet assigned to any milestone — the backlog. */
      unplanned: project.tasks,
      /** Project-wide, by the same rules as every other figure here. */
      progress: summarizeProgress(allTasks as ProgressTask[]),
      schedule,
    };
  }

  /**
   * Today's view: what is planned, and how today is going.
   *
   * `daily` is null when nothing is planned for today. A rest day is not a
   * failure and must not render as 0%.
   */
  async getToday(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, plannedFor: { gte: start, lt: end } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        effort: true,
        priority: true,
        acceptanceCriteria: true,
        milestoneId: true,
        assigneeId: true,
        assigneeName: true,
      },
    });

    return {
      date: start,
      tasks,
      daily: dailyCompletion(tasks as ProgressTask[]),
    };
  }

  /**
   * Applies a scope cut the user confirmed.
   *
   * Takes explicit task ids rather than recomputing the cut list, so what the
   * user saw in the preview is exactly what is applied — a recomputation could
   * drift if anything changed in between.
   *
   * Refuses to defer completed work. The plan requires that rescheduling
   * preserve completed tasks, and silently un-completing work would be the
   * worst possible outcome.
   */
  async deferTasks(userId: string, projectId: string, taskIds: string[]) {
    await this.access.assertMember(userId, projectId);

    if (taskIds.length === 0) {
      throw new BadRequestException('No tasks given to defer.');
    }

    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, projectId },
      select: { id: true, status: true },
    });

    if (tasks.length !== taskIds.length) {
      // Either an id belongs to another project or it no longer exists. Both
      // mean the preview the user confirmed is stale.
      throw new BadRequestException('Some tasks no longer exist on this project. Reload and try again.');
    }

    const completed = tasks.filter((t) => t.status === TaskStatus.DONE);
    if (completed.length > 0) {
      throw new BadRequestException('Completed work cannot be deferred.');
    }

    const result = await this.prisma.task.updateMany({
      where: { id: { in: taskIds }, projectId, status: { not: TaskStatus.DONE } },
      // Cleared from the plan as well as deferred, so a deferred task does not
      // keep occupying a slot in today's list.
      data: { status: TaskStatus.DEFERRED, dailyPlanId: null, plannedFor: null },
    });

    this.logger.log(`Deferred ${result.count} task(s) on project ${projectId} for user ${userId}`);

    return { deferred: result.count };
  }

  /** Brings a deferred or cancelled task back into scope as TODO. */
  async restoreTask(userId: string, projectId: string, taskId: string) {
    await this.access.assertMember(userId, projectId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, status: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found on this project.');
    }

    if (!EXCLUDED_FROM_PROGRESS.includes(task.status)) {
      throw new BadRequestException('That task is already in scope.');
    }

    return this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.TODO },
      select: { id: true, status: true },
    });
  }

  /**
   * Weekly completion history.
   *
   * Reads `completedAt` rather than a separate event log, which is why that
   * column exists. Days with no completions are returned as zero rather than
   * omitted, so the UI can render a continuous week without inventing gaps.
   */
  async getWeeklyHistory(userId: string, projectId: string, days = 7) {
    await this.access.assertMember(userId, projectId);

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const completed = await this.prisma.task.findMany({
      where: { projectId, status: TaskStatus.DONE, completedAt: { gte: start } },
      select: { completedAt: true, effort: true },
    });

    const byDay = new Map<string, { completed: number; points: number }>();
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setUTCDate(day.getUTCDate() + i);
      byDay.set(day.toISOString().slice(0, 10), { completed: 0, points: 0 });
    }

    for (const task of completed) {
      if (!task.completedAt) continue;
      const key = task.completedAt.toISOString().slice(0, 10);
      const entry = byDay.get(key);
      if (entry) {
        entry.completed++;
        entry.points += task.effort ? { SMALL: 1, MEDIUM: 3, LARGE: 8 }[task.effort] : 3;
      }
    }

    return {
      from: start,
      days: [...byDay.entries()].map(([date, value]) => ({ date, ...value })),
    };
  }

  /** Milestone status, kept in step with its tasks. */
  async setMilestoneStatus(userId: string, projectId: string, milestoneId: string, status: MilestoneStatus) {
    await this.access.assertMember(userId, projectId);

    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found on this project.');
    }

    return this.prisma.milestone.update({
      where: { id: milestone.id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  /** Progress for one project, for callers that need only the figures. */
  async getProgress(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: PROGRESS_SELECT,
    });

    return summarizeProgress(tasks as ProgressTask[]);
  }

  /** Exposed for the controller's schedule-preview endpoint. */
  async assess(userId: string, projectId: string): Promise<ScheduleFit> {
    const roadmap = await this.getRoadmap(userId, projectId);
    return roadmap.schedule;
  }
}
