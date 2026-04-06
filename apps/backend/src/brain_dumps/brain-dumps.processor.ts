import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from 'src/common/services/prisma.service';
import { AiService } from 'src/ai/ai.service';
import { Logger } from '@nestjs/common';
import { JOBS, QUEUES } from 'src/common/lib/constants';
import {
  INCUBATOR_RESEARCH_PROMPT,
  INCUBATOR_PLAN_PROMPT,
} from 'src/common/prompts/incubator.prompt';
import { z } from 'zod';

@Processor(QUEUES.INCUBATOR)
export class BrainDumpsProcessor extends WorkerHost {
  private readonly logger = new Logger(BrainDumpsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
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

    const searchQuery = `Documentation, tutorials, and architecture guides for ${title} using ${techStack.join(', ')}. ${summary}`;
    const researchResults = await this.aiService.search(searchQuery);

    const prompt = INCUBATOR_RESEARCH_PROMPT
      .replace('{{title}}', title)
      .replace('{{summary}}', summary)
      .replace('{{techStack}}', techStack.join(', '))
      .replace('{{researchData}}', JSON.stringify(researchResults, null, 2));

    const researchSummary = await this.aiService.generateText(prompt);

    this.logger.log(`Phase 1 complete for project: ${projectId}. Triggering Phase 2.`);

    await job.updateData({ ...job.data, researchSummary });
    await this.incubatorQueue.add(JOBS.PLAN, {
      ...job.data,
      researchSummary,
    });

    return { researchSummary };
  }

  private async handlePlanJob(job: Job<any>) {
    const { projectId, title, techStack, rawTranscript, researchSummary } = job.data;
    this.logger.log(`Phase 2: Generating action plan for project: ${title} (${projectId})`);

    const prompt = INCUBATOR_PLAN_PROMPT
      .replace('{{rawTranscript}}', rawTranscript)
      .replace('{{researchSummary}}', researchSummary)
      .replace('{{title}}', title)
      .replace('{{techStack}}', techStack.join(', '));

    const taskSchema = z.object({
      tasks: z.array(
        z.object({
          title: z.string(),
          status: z.literal('TODO'),
          isImmediateNextStep: z.boolean().describe("True ONLY for the first 1 or 2 steps that must be completed before anything else can begin"),
        }),
      ),
      morningBriefing: z.string().describe("A 1-sentence friendly greeting explaining what the user will focus on next based on this research."),
    });

    const response = await this.aiService.generateStructuredData(
      prompt,
      taskSchema,
      'ActionPlan',
      'You are an expert Software Architect generating a task list.',
    );

    if (response.tasks && response.tasks.length > 0) {
      const createdTasks = await this.prisma.$transaction(
        response.tasks.map((task) =>
          this.prisma.task.create({
            data: {
              projectId,
              title: task.title,
              status: 'TODO',
              isImmediateNextStep: task.isImmediateNextStep,
            },
          }),
        ),
      );

      const immediateTasks = createdTasks.filter((t) => t.isImmediateNextStep);
      if (immediateTasks.length > 0) {
        await Promise.all(
          immediateTasks.map((task) =>
            this.incubatorQueue.add(JOBS.TASK_RESEARCH, {
              taskId: task.id,
              projectId,
              taskTitle: task.title,
              projectTitle: title,
              techStack,
            }),
          ),
        );
        this.logger.log(`Queued TASK_RESEARCH for ${immediateTasks.length} immediate task(s) in project ${projectId}`);
      }
    }

    this.logger.log(`Phase 2 complete for project: ${projectId}. Action plan generated.`);
    return { tasksGenerated: response.tasks.length };
  }

  private async handleTaskResearchJob(job: Job<any>) {
    const { taskId, projectId, taskTitle, projectTitle, techStack } = job.data;
    this.logger.log(`TASK_RESEARCH: Fetching resources for task "${taskTitle}" (${taskId})`);

    const searchQuery = `${taskTitle} — implementation guide, documentation, examples. Project: ${projectTitle}. Tech: ${techStack.join(', ')}`;
    const searchResults = await this.aiService.search(searchQuery);

    if (searchResults.length === 0) {
      this.logger.warn(`TASK_RESEARCH: No results found for task ${taskId}`);
      return;
    }

    await Promise.all(
      searchResults.map((res) =>
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

    this.logger.log(`TASK_RESEARCH: Stored ${searchResults.length} resources for task ${taskId}`);
  }
}
