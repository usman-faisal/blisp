import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectStatus, TaskStatus } from '@repo/db';
import { GetTodayPlanResponse, PullNextTaskResponse } from '@repo/types';
import { JOBS, QUEUES } from 'src/common/lib/constants';

@Injectable()
export class DailyPlansService {
  private readonly logger = new Logger(DailyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) { }

  /**
   * Pulls exactly one additional backlog task into the user's plan for today.
   */
  async pullNextTask(userId: string): Promise<PullNextTaskResponse> {
    const today = this.getTodayDate();

    const todayPlan = await this.prisma.dailyPlan.findUnique({
      where: { userId_planDate: { userId, planDate: today } },
    });

    if (!todayPlan) {
      this.logger.warn(`No daily plan found for user ${userId} on ${today.toISOString()}.`);
      throw new NotFoundException(
        "You don't have a daily plan for today yet. Make sure you have at least one active project so the planner can build one for you.",
      );
    }

    const nextTask = await this.prisma.task.findFirst({
      where: {
        status: TaskStatus.TODO,
        dailyPlanId: null,
        project: {
          userId,
          status: ProjectStatus.ACTIVE,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        project: { select: { id: true, title: true, techStack: true } },
      },
    });

    if (!nextTask) {
      this.logger.log(`User ${userId} has cleared their entire active backlog. 🎉`);
      return {
        data: null,
        message:
          "You've cleared your entire active backlog — nothing left to pull. Enjoy the momentum or add a new brain dump!",
        success: true,
      };
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: nextTask.id },
      data: {
        dailyPlanId: todayPlan.id,
        plannedFor: today,
      },
      include: {
        project: { select: { id: true, title: true, techStack: true } },
      },
    });

    const existingResources = await this.prisma.resource.count({
      where: { taskId: updatedTask.id },
    });

    if (existingResources === 0) {
      await this.incubatorQueue.add(JOBS.TASK_RESEARCH, {
        taskId: updatedTask.id,
        projectId: updatedTask.project.id,
        taskTitle: updatedTask.title,
        projectTitle: updatedTask.project.title,
        techStack: updatedTask.project.techStack,
      });
      this.logger.log(`Queued TASK_RESEARCH for pulled task ${updatedTask.id}`);
    }

    this.logger.log(
      `Pulled task "${updatedTask.title}" (${updatedTask.id}) into plan ${todayPlan.id} for user ${userId}.`,
    );

    return {
      data: {
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        projectTitle: updatedTask.project.title,
        status: updatedTask.status,
        plannedFor: updatedTask.plannedFor,
      },
      message: `"${updatedTask.title}" from ${updatedTask.project.title} has been added to your plan for today.`,
      success: true,
    };
  }

  /**
   * Returns today's date normalised to midnight UTC so it aligns with the
   * Prisma `@db.Date` column (no time component stored).
   */
  private getTodayDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  /**
   * Retrieves today's daily plan for the user, along with its tasks.
   */
  async getTodayPlan(userId: string): Promise<GetTodayPlanResponse> {
    const today = this.getTodayDate();

    const todayPlan = await this.prisma.dailyPlan.findUnique({
      where: { userId_planDate: { userId, planDate: today } },
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!todayPlan) {
      return {
        data: null,
        message: 'No daily plan found for today.',
        success: true,
      };
    }

    return {
      data: {
        id: todayPlan.id,
        summary: todayPlan.summary,
        tasks: todayPlan.tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      },
      message: 'Today\'s daily plan retrieved.',
      success: true,
    };
  }
}
