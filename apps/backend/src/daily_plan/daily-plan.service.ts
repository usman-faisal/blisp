import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/common/services/prisma.service';
import { AiService } from 'src/ai/ai.service';
import { ProjectStatus, TaskStatus, PipelineStage } from '@repo/db';
import { DAILY_BRIEFING_SYSTEM_PROMPT } from 'src/common/prompts/daily-plan.prompt';
import { JOBS, QUEUES } from 'src/common/lib/constants';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';

/** Maximum number of backlog tasks to pull into a single daily plan. */
const MAX_TASKS_PER_DAY = 4;

@Injectable()
export class DailyPlanCronService {
  private readonly logger = new Logger(DailyPlanCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly pipelineEvents: PipelineEventsService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) { }

  /**
   * Hourly sweep – ensures every active user has a DailyPlan for today.
   * Runs at the top of every hour (e.g. 09:00, 10:00, …).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runDailyPlanSweep(): Promise<void> {
    this.logger.log('⏰ Daily plan sweep started.');

    const activeUsers = await this.prisma.user.findMany({
      where: {
        projects: {
          some: { status: ProjectStatus.ACTIVE },
        },
      },
      select: { id: true },
    });

    if (activeUsers.length === 0) {
      this.logger.log('No active users found. Sweep complete.');
      return;
    }

    this.logger.log(`Found ${activeUsers.length} active user(s). Processing…`);

    for (const { id: userId } of activeUsers) {
      await this.processUserPlan(userId);
    }

    this.logger.log('✅ Daily plan sweep complete.');
  }

  async processUserPlan(userId: string): Promise<void> {
    const today = this.getTodayDate();

    const existingPlan = await this.prisma.dailyPlan.findUnique({
      where: { userId_planDate: { userId, planDate: today } },
    });

    if (existingPlan) {
      this.logger.verbose(`User ${userId} already has a plan for today. Skipping.`);
      return;
    }

    // Which tasks belong in this user's plan on a shared project.
    //
    // Membership alone is not enough: with three members on one project, every
    // member would receive an identical plan containing each other's tasks. So
    // a task counts as theirs when they are the assignee, or when nobody has
    // claimed it and they created the project — unassigned work stays with the
    // owner rather than being duplicated across the team.
    const ownedByUser = {
      project: {
        status: ProjectStatus.ACTIVE,
        members: { some: { userId } },
      },
      OR: [
        { assigneeId: userId },
        { assigneeId: null, project: { userId } },
      ],
    };

    // Roll over incomplete tasks from previous plans
    await this.prisma.task.updateMany({
      where: {
        status: TaskStatus.TODO,
        dailyPlanId: { not: null },
        plannedFor: { lt: today },
        ...ownedByUser,
      },
      data: {
        dailyPlanId: null,
        plannedFor: null,
      },
    });

    const backlogTasks = await this.prisma.task.findMany({
      where: {
        dailyPlanId: null,
        status: TaskStatus.TODO,
        ...ownedByUser,
      },
      take: MAX_TASKS_PER_DAY,
      orderBy: { createdAt: 'asc' },
      include: {
        project: { select: { id: true, title: true, techStack: true } },
      },
    });

    if (backlogTasks.length === 0) {
      this.logger.verbose(`User ${userId} has no backlog tasks to plan. Skipping.`);
      return;
    }

    this.logger.log(
      `Building daily plan for user ${userId} with ${backlogTasks.length} task(s).`,
    );

    // Emit DAILY_PLAN_STARTED for each unique project in the batch
    const projectIds = [...new Set(backlogTasks.map((t) => t.project.id))];
    await Promise.all(
      projectIds.map((pid) =>
        this.pipelineEvents.emit(
          pid,
          PipelineStage.DAILY_PLAN_STARTED,
          'Building your daily plan and morning briefing',
        ),
      ),
    );

    const briefingPrompt = this.buildBriefingPrompt(backlogTasks);
    let summary: string;

    try {
      summary = await this.aiService.generateText(briefingPrompt);
      this.logger.verbose(`Morning briefing generated for user ${userId}.`);
    } catch (err) {
      this.logger.error(
        `Failed to generate morning briefing for user ${userId}. Falling back to plain summary.`,
        err,
      );
      summary = this.buildFallbackSummary(backlogTasks);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const plan = await tx.dailyPlan.create({
          data: {
            userId,
            planDate: today,
            summary,
          },
        });

        await tx.task.updateMany({
          where: { id: { in: backlogTasks.map((t) => t.id) } },
          data: {
            dailyPlanId: plan.id,
            plannedFor: today,
          },
        });

        this.logger.log(
          `✔ DailyPlan ${plan.id} created for user ${userId} with ${backlogTasks.length} task(s).`,
        );
      });
      // Emit DAILY_PLAN_COMPLETED for each unique project
      await Promise.all(
        projectIds.map((pid) =>
          this.pipelineEvents.emit(
            pid,
            PipelineStage.DAILY_PLAN_COMPLETED,
            `Daily plan ready with ${backlogTasks.length} task(s)`,
          ),
        ),
      );

      await this.queueResourceFetching(backlogTasks);
    } catch (err) {
      this.logger.error(`Transaction failed for user ${userId}.`, err);
    }
  }

  /**
   * Queues TASK_RESEARCH jobs for tasks that don't already have resources.
   */
  private async queueResourceFetching(
    tasks: Array<{
      id: string;
      title: string;
      project: { id: string; title: string; techStack: string[] };
    }>,
  ): Promise<void> {
    const taskIds = tasks.map((t) => t.id);

    const tasksWithResources = await this.prisma.resource.groupBy({
      by: ['taskId'],
      where: { taskId: { in: taskIds } },
    });

    const taskIdsWithResources = new Set(
      tasksWithResources.map((r) => r.taskId),
    );

    const tasksNeedingResources = tasks.filter(
      (t) => !taskIdsWithResources.has(t.id),
    );

    if (tasksNeedingResources.length === 0) return;

    await Promise.all(
      tasksNeedingResources.map((task) =>
        this.incubatorQueue.add(JOBS.TASK_RESEARCH, {
          taskId: task.id,
          projectId: task.project.id,
          taskTitle: task.title,
          projectTitle: task.project.title,
          techStack: task.project.techStack,
        }),
      ),
    );

    this.logger.log(
      `Queued TASK_RESEARCH for ${tasksNeedingResources.length} task(s) in daily plan.`,
    );
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

  private buildBriefingPrompt(
    tasks: Array<{ title: string; project: { title: string } }>,
  ): string {
    const taskLines = tasks
      .map((t) => `- "${t.title}" (Project: ${t.project.title})`)
      .join('\n');

    return (
      `${DAILY_BRIEFING_SYSTEM_PROMPT}\n\n` +
      `Here are the tasks the user will focus on today:\n${taskLines}\n\n` +
      `Write the 2-sentence morning briefing now:`
    );
  }

  private buildFallbackSummary(
    tasks: Array<{ title: string; project: { title: string } }>,
  ): string {
    const taskTitles = tasks.map((t) => `"${t.title}"`).join(' and ');
    return `Today you're focusing on ${taskTitles}. Stay focused and make progress one step at a time.`;
  }
}
