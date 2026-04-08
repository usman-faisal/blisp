import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from 'src/common/services/prisma.service';
import { AiService } from 'src/ai/ai.service';
import { Logger } from '@nestjs/common';
import { JOBS, QUEUES } from 'src/common/lib/constants';
import { ProjectStatus } from '@repo/db';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';
import { PipelineEventsService } from 'src/pipeline_events/pipeline-events.service';
import { PipelineStage } from '@repo/db';
import { INCUBATOR_RESEARCH_PROMPT, INCUBATOR_PLAN_PROMPT } from 'src/common/prompts/incubator.prompt';
import { z } from 'zod';
import { TavilyResult } from 'src/common/types/type';

@Processor(QUEUES.INCUBATOR)
export class BrainDumpsProcessor extends WorkerHost {
  private readonly logger = new Logger(BrainDumpsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly dailyPlanCronService: DailyPlanCronService,
    private readonly pipelineEvents: PipelineEventsService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case JOBS.RESEARCH:
        return this.handleResearchJob(job);
      case JOBS.PLAN:
        return this.handlePlanJob(job);
      case JOBS.TASK_RESEARCH:
        return this.handleTaskResearchJob(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleResearchJob(job: Job<any>) {
    const { projectId, title, summary, techStack } = job.data;
    this.logger.log(`Phase 1: Starting research for project: ${title} (${projectId})`);

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.RESEARCH_STARTED,
      `Researching documentation and architecture for "${title}"`,
    );

    const searchQuery = `Documentation, tutorials, and architecture guides for ${title} using ${techStack.join(', ')}. ${summary}`;
    const researchResults = await this.aiService.search(searchQuery);

    const prompt = INCUBATOR_RESEARCH_PROMPT.replace('{{title}}', title)
      .replace('{{summary}}', summary)
      .replace('{{techStack}}', techStack.join(', '))
      .replace('{{researchData}}', JSON.stringify(researchResults, null, 2));

    const researchSummary = await this.aiService.generateText(prompt);

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.RESEARCH_COMPLETED,
      `Found ${researchResults.length} relevant sources and synthesized a research summary`,
    );

    this.logger.log(`Phase 1 complete for project: ${projectId}. Triggering Phase 2.`);

    await job.updateData({ ...job.data, researchSummary });
    await this.incubatorQueue.add(JOBS.PLAN, {
      ...job.data,
      researchSummary,
    });

    return { researchSummary };
  }

  private async handlePlanJob(job: Job<any>) {
    const { projectId, userId, title, techStack, rawTranscript, researchSummary } = job.data;
    this.logger.log(`Phase 2: Generating action plan for project: ${title} (${projectId})`);

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.PLAN_STARTED,
      'Generating your action plan from the research',
    );

    const prompt = INCUBATOR_PLAN_PROMPT.replace('{{rawTranscript}}', rawTranscript)
      .replace('{{researchSummary}}', researchSummary)
      .replace('{{title}}', title)
      .replace('{{techStack}}', techStack.join(', '));

    const taskSchema = z.object({
      tasks: z.array(
        z.object({
          title: z.string(),
          status: z.literal('TODO'),
          resourceQueries: z.array(z.string()).max(2)
            .describe('1-2 highly specific search queries to find implementation resources for this exact task. Be precise — include library names, versions, specific patterns.'),
        }),
      ),
      morningBriefing: z.string(),
    });

    const response = await this.aiService.generateStructuredData(
      prompt,
      taskSchema,
      'ActionPlan',
      'You are an expert Software Architect generating a task list.',
    );

    if (response.tasks && response.tasks.length > 0) {
      await this.prisma.$transaction(
        response.tasks.map((task) =>
          this.prisma.task.create({
            data: {
              projectId,
              title: task.title,
              status: 'TODO',
              resourceQueries: task.resourceQueries,
            },
          }),
        ),
      );
    }

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.PLAN_COMPLETED,
      `Created ${response.tasks.length} actionable tasks`,
    );

    // Auto-activate if this is the user's very first project
    const otherProjectCount = await this.prisma.project.count({
      where: { userId, id: { not: projectId }, status: { not: ProjectStatus.ARCHIVED } },
    });

    if (otherProjectCount === 0) {
      this.logger.log(`First project for user ${userId} — auto-activating ${projectId}`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.ACTIVE },
      });
      this.dailyPlanCronService
        .processUserPlan(userId)
        .catch((err) => this.logger.error('processUserPlan failed after auto-activation', err));
    }

    this.logger.log(`Phase 2 complete for project: ${projectId}. Action plan generated.`);
    return { tasksGenerated: response.tasks.length };
  }

  private async handleTaskResearchJob(job: Job<any>) {
    const { taskId, projectId, taskTitle, projectTitle, techStack } = job.data;

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.RESOURCE_FETCH_STARTED,
      `Finding resources for "${taskTitle}"`,
    );

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { resourceQueries: true },
    });

    const queries = task?.resourceQueries?.length
      ? task.resourceQueries
      : [`${taskTitle} ${techStack.join(' ')} tutorial`];

    const allResults: TavilyResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      const results = await this.aiService.search(query);
      for (const r of results) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          allResults.push(r);
        }
      }
    }

    if (allResults.length === 0) {
      await this.pipelineEvents.emit(
        projectId,
        PipelineStage.RESOURCE_FETCH_COMPLETED,
        `No additional resources found for "${taskTitle}"`,
      );
      return;
    }

    // LLM picks the top 1-2 most relevant
    const rankingPrompt = `Task: "${taskTitle}" (Project: ${projectTitle}, Stack: ${techStack.join(', ')})

Here are search results. Pick the 1-2 MOST relevant resources that would directly help someone implement this specific task. Return only the indices (0-based) as a JSON array of numbers.

${allResults.map((r, i) => `[${i}] ${r.title} — ${r.url}\n${r.snippet || ''}`).join('\n\n')}`;

    const ranked = await this.aiService.generateStructuredData(
      rankingPrompt,
      z.object({ indices: z.array(z.number()).max(2) }),
      'ResourceRanking',
      'You are a technical resource curator. Be selective — only pick resources that directly address the task.',
    );

    const topResults = ranked.indices
      .filter(i => i >= 0 && i < allResults.length)
      .map(i => allResults[i]);

    await Promise.all(
      topResults.map((res) =>
        this.prisma.resource.create({
          data: {
            projectId,
            taskId,
            title: res.title,
            url: res.url,
            summary: res.content || res.snippet,
            type: 'RESEARCH',
          },
        }),
      ),
    );

    await this.pipelineEvents.emit(
      projectId,
      PipelineStage.RESOURCE_FETCH_COMPLETED,
      `Found ${topResults.length} resource(s) for "${taskTitle}"`,
    );
  }
}
