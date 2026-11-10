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
import { ResearchService } from 'src/research/research.service';

/**
 * Payloads carried on the INCUBATOR queue, by job name.
 *
 * Previously every handler took `Job<any>`, which made each `job.data` read
 * untyped — a renamed field would have surfaced as `undefined` inside a prompt
 * rather than as a compile error.
 */
interface ResearchJobData {
  projectId: string;
  userId: string;
  title: string;
  summary: string;
  techStack: string[];
  rawTranscript: string;
}

/** The research job forwards its own data plus the summary it produced. */
type PlanJobData = ResearchJobData & { researchSummary: string };

interface TaskResearchJobData {
  taskId: string;
  projectId: string;
  taskTitle: string;
  projectTitle: string;
  techStack: string[];
}

interface DiscoveryReportJobData {
  reportId: string;
  projectId: string;
}

type IncubatorJobData = ResearchJobData | PlanJobData | TaskResearchJobData | DiscoveryReportJobData;

@Processor(QUEUES.INCUBATOR)
export class BrainDumpsProcessor extends WorkerHost {
  private readonly logger = new Logger(BrainDumpsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly dailyPlanCronService: DailyPlanCronService,
    private readonly pipelineEvents: PipelineEventsService,
    private readonly researchService: ResearchService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<IncubatorJobData, unknown, string>): Promise<unknown> {
    // BullMQ dispatches by name, so the payload type is only knowable per
    // branch. Each cast is immediately adjacent to the name that guarantees it.
    switch (job.name) {
      case JOBS.RESEARCH:
        return this.handleResearchJob(job as Job<ResearchJobData>);
      case JOBS.PLAN:
        return this.handlePlanJob(job as Job<PlanJobData>);
      case JOBS.TASK_RESEARCH:
        return this.handleTaskResearchJob(job as Job<TaskResearchJobData>);
      case JOBS.DISCOVERY_REPORT:
        return this.handleDiscoveryReportJob(job as Job<DiscoveryReportJobData>);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return undefined;
    }
  }

  private async handleResearchJob(job: Job<ResearchJobData>) {
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

    const planData: PlanJobData = { ...job.data, researchSummary };

    // Recorded on this job too, so a retry or an inspection of the completed
    // job shows what Phase 2 was handed.
    await (job as Job<PlanJobData>).updateData(planData);
    await this.incubatorQueue.add(JOBS.PLAN, planData);

    return { researchSummary };
  }

  private async handlePlanJob(job: Job<PlanJobData>) {
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
          resourceQueries: z
            .array(z.string())
            .max(2)
            .describe(
              '1-2 highly specific search queries to find implementation resources for this exact task. Be precise — include library names, versions, specific patterns.',
            ),
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

  /**
   * On-demand discovery report. ResearchService owns the work and records its
   * own success/failure on the report row, so this is a thin delegation.
   */
  private async handleDiscoveryReportJob(job: Job<DiscoveryReportJobData>) {
    const { reportId, projectId } = job.data;
    this.logger.log(`Generating discovery report ${reportId} for project ${projectId}`);

    await this.researchService.generateReport(reportId, projectId);

    return { reportId };
  }

  private async handleTaskResearchJob(job: Job<TaskResearchJobData>) {
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

    const topResults = ranked.indices.filter((i) => i >= 0 && i < allResults.length).map((i) => allResults[i]);

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
