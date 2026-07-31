import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectMember, ProjectRole } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';

/**
 * Single source of truth for "may this user touch this project?".
 *
 * Access used to be a `where: { id, userId }` filter on every query, which made
 * ownership and access the same thing. Collaboration splits them: `Project.userId`
 * stays the creator (brain dumps and pipeline events are per-user), while
 * membership decides who can read and write.
 *
 * Every method throws rather than returning null so a caller cannot silently
 * skip the check by ignoring a falsy return.
 */
@Injectable()
export class ProjectAccessService {
  /** Maximum collaborators per project, owner included. */
  static readonly MAX_MEMBERS = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws unless the user is a member (any role) of the project.
   * Returns the membership row so callers can inspect the role without a
   * second query.
   */
  async assertMember(userId: string, projectId: string): Promise<ProjectMember> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!membership) {
      // Deliberately NotFound, not Forbidden: telling a stranger that a project
      // exists but is not theirs leaks the existence of other users' projects.
      throw new NotFoundException('Project not found');
    }

    return membership;
  }

  /** Throws unless the user is the project's OWNER. */
  async assertOwner(userId: string, projectId: string): Promise<ProjectMember> {
    const membership = await this.assertMember(userId, projectId);

    if (membership.role !== ProjectRole.OWNER) {
      // The user is a member, so the project's existence is not a secret from
      // them — Forbidden is the honest answer here.
      throw new ForbiddenException('Only the project owner can perform this action');
    }

    return membership;
  }

  /**
   * Project ids the user can see. Use to scope list queries:
   *   where: { id: { in: await memberProjectIds(userId) } }
   */
  async memberProjectIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });

    return rows.map((row) => row.projectId);
  }

  /** True when the user is a member, without throwing. For conditional UI data. */
  async isMember(userId: string, projectId: string): Promise<boolean> {
    const count = await this.prisma.projectMember.count({
      where: { projectId, userId },
    });

    return count > 0;
  }

  /**
   * Throws when the project already holds MAX_MEMBERS. Called before accepting
   * an invite. Enforced server-side because the client cannot be trusted to
   * count.
   */
  async assertHasCapacity(projectId: string): Promise<void> {
    const count = await this.prisma.projectMember.count({ where: { projectId } });

    if (count >= ProjectAccessService.MAX_MEMBERS) {
      throw new ForbiddenException(
        `This project already has the maximum of ${ProjectAccessService.MAX_MEMBERS} members`,
      );
    }
  }
}
