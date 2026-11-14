import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EvidenceSource, TaskStatus, VerificationVerdict } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { GithubApiError, GithubClient, GithubCommit, GithubRepoInfo } from './github.client';
import { matchCommit } from './matcher';
import { summarizeVerification, verifyCompletion } from './verification';

/**
 * Linking repositories and turning their history into completion evidence.
 *
 * The flow is deliberately one-directional: GitHub is observed, never written
 * to, and a verdict is always *derived* from stored evidence rather than set.
 * No method here accepts a verdict as input, which is what makes the result
 * meaningful — a user can change a task's status freely, but cannot change
 * what the evidence says about it.
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly github: GithubClient,
  ) {}

  /**
   * Links a repository to a project after confirming it is actually readable.
   *
   * The existence check is not optional politeness: storing a link that cannot
   * be read would produce a project that silently never verifies anything,
   * which is the worst failure mode for this feature because it looks like
   * "no evidence found" rather than "misconfigured".
   */
  async linkRepository(userId: string, projectId: string, input: string, token?: string) {
    await this.access.assertMember(userId, projectId);

    const parsed = GithubClient.parseRepo(input);
    if (!parsed) {
      throw new BadRequestException('Enter a repository as "owner/name" or a GitHub URL.');
    }

    let info: GithubRepoInfo;
    try {
      info = await this.github.getRepository(parsed.owner, parsed.name, token);
    } catch (error) {
      throw this.toHttpError(error);
    }

    // A private repository with no token would link and then fail on every
    // sync, so it is refused now with an explanation.
    if (info.isPrivate && !token) {
      throw new BadRequestException(
        'That repository is private. Provide a personal access token with read access, or use a public repository.',
      );
    }

    const repository = await this.prisma.projectRepository.upsert({
      where: { projectId_githubId: { projectId, githubId: BigInt(info.githubId) } },
      create: {
        projectId,
        owner: info.owner,
        name: info.name,
        githubId: BigInt(info.githubId),
        defaultBranch: info.defaultBranch,
        isPrivate: info.isPrivate,
        accessToken: token ?? null,
        linkedById: userId,
      },
      // Re-linking refreshes the token and a renamed repo's owner/name rather
      // than creating a duplicate row.
      update: {
        owner: info.owner,
        name: info.name,
        defaultBranch: info.defaultBranch,
        isPrivate: info.isPrivate,
        ...(token ? { accessToken: token } : {}),
        lastSyncError: null,
      },
    });

    return this.presentRepository(repository);
  }

  async listRepositories(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    const repositories = await this.prisma.projectRepository.findMany({
      where: { projectId },
      orderBy: { linkedAt: 'asc' },
    });

    return repositories.map((repository) => this.presentRepository(repository));
  }

  async unlinkRepository(userId: string, projectId: string, repositoryId: string) {
    await this.access.assertMember(userId, projectId);

    const repository = await this.prisma.projectRepository.findFirst({
      where: { id: repositoryId, projectId },
    });

    if (!repository) {
      throw new NotFoundException('That repository is not linked to this project.');
    }

    await this.prisma.projectRepository.delete({ where: { id: repositoryId } });

    // Evidence rows survive via SetNull, but the verdicts that cited them are
    // now unsupported, so every task is re-judged against what remains.
    await this.recomputeProject(projectId);

    return { unlinked: true };
  }

  /**
   * Fetches new commits and records any that reference a task.
   *
   * Incremental: only commits after the last successful sync are requested, so
   * a repeat sync costs one small page rather than the whole history. That
   * matters on the unauthenticated budget of 60 requests per hour.
   */
  async syncRepository(userId: string, projectId: string, repositoryId: string) {
    await this.access.assertMember(userId, projectId);

    const repository = await this.prisma.projectRepository.findFirst({
      where: { id: repositoryId, projectId },
    });

    if (!repository) {
      throw new NotFoundException('That repository is not linked to this project.');
    }

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { id: true, title: true },
    });

    let commits: GithubCommit[];
    try {
      commits = await this.github.listCommits(repository.owner, repository.name, {
        since: repository.lastSyncedAt,
        token: repository.accessToken,
      });
    } catch (error) {
      // Recorded rather than swallowed: an empty evidence list and a failed
      // fetch look identical in the UI otherwise, and the user would read
      // "nothing found" when the truth is "we could not look".
      const message = error instanceof Error ? error.message : 'Sync failed.';
      await this.prisma.projectRepository.update({
        where: { id: repositoryId },
        data: { lastSyncError: message },
      });
      throw this.toHttpError(error);
    }

    let recorded = 0;
    const touchedTaskIds = new Set<string>();

    for (const commit of commits) {
      for (const match of matchCommit(commit, tasks)) {
        // createMany + skipDuplicates would also work, but doing it per match
        // keeps the unique-constraint handling explicit and lets a single
        // malformed row fail without discarding the rest of the page.
        const created = await this.prisma.taskEvidence.createMany({
          data: [
            {
              taskId: match.taskId,
              source: EvidenceSource.COMMIT,
              externalId: commit.sha,
              title: firstLine(commit.message),
              url: commit.url,
              authorLogin: commit.authorLogin,
              occurredAt: commit.occurredAt,
              matchReason: match.reason,
              repositoryId: repository.id,
            },
          ],
          skipDuplicates: true,
        });

        if (created.count > 0) {
          recorded += created.count;
          touchedTaskIds.add(match.taskId);
        }
      }
    }

    await this.prisma.projectRepository.update({
      where: { id: repositoryId },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });

    // Only the tasks whose evidence changed are re-judged. The rest cannot
    // have changed verdict, and recomputing them would be wasted work.
    for (const taskId of touchedTaskIds) {
      await this.recomputeTask(taskId);
    }

    return {
      commitsScanned: commits.length,
      evidenceRecorded: recorded,
      tasksUpdated: touchedTaskIds.size,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Attaches a commit to a task by hand.
   *
   * Recorded as MANUAL so the UI can present it as a weaker claim: a person
   * chose this, where a COMMIT row was observed independently. Passing the two
   * off as equivalent would overstate what the system actually knows.
   */
  async addManualEvidence(userId: string, projectId: string, taskId: string, input: { url: string; title?: string }) {
    await this.access.assertMember(userId, projectId);

    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) {
      throw new NotFoundException('That task is not part of this project.');
    }

    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new BadRequestException('Enter a valid URL.');
    }

    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      throw new BadRequestException('Only GitHub links can be attached as evidence.');
    }

    await this.prisma.taskEvidence.createMany({
      data: [
        {
          taskId,
          source: EvidenceSource.MANUAL,
          externalId: url.pathname,
          title: input.title?.trim() || url.pathname,
          url: url.toString(),
          occurredAt: new Date(),
          matchReason: 'Attached by a project member',
          addedById: userId,
        },
      ],
      skipDuplicates: true,
    });

    return this.recomputeTask(taskId);
  }

  async removeEvidence(userId: string, projectId: string, evidenceId: string) {
    await this.access.assertMember(userId, projectId);

    const evidence = await this.prisma.taskEvidence.findFirst({
      where: { id: evidenceId, task: { projectId } },
    });

    if (!evidence) {
      throw new NotFoundException('That evidence does not exist on this project.');
    }

    await this.prisma.taskEvidence.delete({ where: { id: evidenceId } });

    return this.recomputeTask(evidence.taskId);
  }

  /**
   * Re-judges one task against its stored evidence.
   *
   * Called whenever either side of the claim changes — the task's status, or
   * the evidence for it. There is no path that writes a verdict directly.
   */
  async recomputeTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        status: true,
        createdAt: true,
        completedAt: true,
        evidence: {
          select: { source: true, externalId: true, occurredAt: true, authorLogin: true },
        },
      },
    });

    if (!task) return null;

    const repositoryCount = await this.prisma.projectRepository.count({
      where: { projectId: task.projectId },
    });

    const outcome = verifyCompletion(
      { id: task.id, status: task.status, createdAt: task.createdAt, completedAt: task.completedAt },
      task.evidence,
      repositoryCount > 0,
    );

    const verification = await this.prisma.taskVerification.upsert({
      where: { taskId },
      create: {
        taskId,
        verdict: outcome.verdict,
        evidenceCount: outcome.evidenceCount,
        summary: outcome.summary,
        claimedAt: outcome.claimedAt,
      },
      update: {
        verdict: outcome.verdict,
        evidenceCount: outcome.evidenceCount,
        summary: outcome.summary,
        claimedAt: outcome.claimedAt,
        computedAt: new Date(),
      },
    });

    return {
      taskId,
      verdict: verification.verdict,
      evidenceCount: verification.evidenceCount,
      summary: verification.summary,
    };
  }

  /** Re-judges every task on a project, e.g. after a repository is unlinked. */
  async recomputeProject(projectId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: { id: true },
    });

    for (const task of tasks) {
      await this.recomputeTask(task.id);
    }

    return tasks.length;
  }

  /** Evidence and verdict for one task, for the task detail screen. */
  async getTaskVerification(userId: string, projectId: string, taskId: string) {
    await this.access.assertMember(userId, projectId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: {
        id: true,
        verification: true,
        evidence: { orderBy: { occurredAt: 'desc' } },
      },
    });

    if (!task) {
      throw new NotFoundException('That task is not part of this project.');
    }

    return {
      taskId,
      verdict: task.verification?.verdict ?? null,
      summary: task.verification?.summary ?? null,
      evidence: task.evidence.map((item) => ({
        id: item.id,
        source: item.source,
        externalId: item.externalId,
        title: item.title,
        url: item.url,
        authorLogin: item.authorLogin,
        occurredAt: item.occurredAt.toISOString(),
        matchReason: item.matchReason,
      })),
    };
  }

  /** Project-wide verification totals, for the line under overall progress. */
  async getProjectVerification(userId: string, projectId: string) {
    await this.access.assertMember(userId, projectId);

    // Only completed tasks make a claim worth summarising; a TODO task has
    // nothing to verify and would dilute the ratio.
    const verifications = await this.prisma.taskVerification.findMany({
      where: { task: { projectId, status: TaskStatus.DONE } },
      select: { verdict: true },
    });

    return summarizeVerification(verifications);
  }

  private presentRepository(repository: {
    id: string;
    owner: string;
    name: string;
    githubId: bigint;
    defaultBranch: string;
    isPrivate: boolean;
    accessToken: string | null;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
  }) {
    return {
      id: repository.id,
      owner: repository.owner,
      name: repository.name,
      fullName: `${repository.owner}/${repository.name}`,
      url: `https://github.com/${repository.owner}/${repository.name}`,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
      // Whether a token exists, never the token itself.
      hasToken: repository.accessToken !== null,
      lastSyncedAt: repository.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: repository.lastSyncError,
    };
  }

  /** Maps a GitHub failure onto a status the client can act on. */
  private toHttpError(error: unknown): Error {
    if (error instanceof GithubApiError) {
      if (error.status === 404) return new NotFoundException(error.message);
      if (error.status === 429 || error.status === 401 || error.status === 403) {
        return new BadRequestException(error.message);
      }
      return new BadRequestException(error.message);
    }

    this.logger.error(`Unexpected GitHub failure: ${error instanceof Error ? error.message : 'unknown'}`);
    return new BadRequestException('Could not reach GitHub. Please try again.');
  }
}

/** Commit subject only — bodies can be long and are not worth storing here. */
function firstLine(message: string): string {
  const line = message.split('\n')[0]?.trim() ?? '';
  return line.length > 0 ? line.slice(0, 500) : '(no commit message)';
}

export { VerificationVerdict };
