import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ProjectRole } from '@repo/db';
import {
  AcceptInviteResponse,
  CreateInviteResponse,
  GetInvitePreviewResponse,
  GetProjectMembersResponse,
  RemoveMemberResponse,
} from '@repo/types';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';

/** How long a fresh invite stays usable. */
const INVITE_TTL_DAYS = 7;

/**
 * Unambiguous alphabet: no O/0, I/1, L. Invite codes get read aloud and typed
 * by hand, so the visually confusable characters are worth losing.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Generates a code with crypto.randomBytes — not Math.random, which is
   * predictable and would let someone guess their way into a project.
   *
   * Rejection sampling keeps the distribution uniform: taking `byte % length`
   * directly would bias toward the front of the alphabet.
   */
  private generateCode(): string {
    const max = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
    let code = '';

    while (code.length < CODE_LENGTH) {
      for (const byte of randomBytes(CODE_LENGTH)) {
        if (byte < max) {
          code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
          if (code.length === CODE_LENGTH) break;
        }
      }
    }

    return code;
  }

  async createInvite(userId: string, projectId: string): Promise<CreateInviteResponse> {
    // Any member may invite; the cap is what limits growth, not the role.
    await this.access.assertMember(userId, projectId);

    // Fail early rather than handing out a code that cannot be redeemed.
    await this.access.assertHasCapacity(projectId);

    // Snapshot the inviter's name onto the row so it reads without a join.
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!creator) {
      throw new NotFoundException('Your user record was not found.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    // The unique constraint on `code` makes a collision a write error rather
    // than a silent overwrite. Retry a few times; at 31^8 this is vanishingly
    // rare, but "vanishingly rare" is not "never".
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();

      try {
        const invite = await this.prisma.projectInvite.create({
          data: {
            projectId,
            code,
            createdBy: userId,
            createdByName: creator.name,
            expiresAt,
          },
        });

        this.logger.log(`Invite ${invite.code} created for project ${projectId} by ${userId}.`);

        return {
          data: {
            code: invite.code,
            expiresAt: invite.expiresAt.toISOString(),
            shareUrl: `blisp://invite/${invite.code}`,
          },
          message: 'Invite created successfully.',
          success: true,
        };
      } catch (error) {
        if (attempt === 4) throw error;
        this.logger.warn(`Invite code collision on ${code}, retrying.`);
      }
    }

    // Unreachable: the loop either returns or rethrows on the final attempt.
    throw new ConflictException('Could not generate a unique invite code.');
  }

  async getInvitePreview(userId: string, code: string): Promise<GetInvitePreviewResponse> {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            _count: { select: { members: true } },
          },
        },
        creator: { select: { name: true } },
      },
    });

    if (!invite) {
      throw new NotFoundException('This invite code is not valid.');
    }

    // Distinct errors for used vs expired, so the UI can say which one it is
    // instead of a generic "invalid code".
    if (invite.usedAt) {
      throw new GoneException('This invite has already been used.');
    }

    if (invite.expiresAt < new Date()) {
      throw new GoneException('This invite has expired.');
    }

    return {
      data: {
        code: invite.code,
        projectTitle: invite.project.title,
        projectDescription: invite.project.description,
        memberCount: invite.project._count.members,
        // Joined via the creator relation — one query instead of two.
        invitedBy: invite.creator.name,
        alreadyMember: await this.access.isMember(userId, invite.projectId),
      },
      message: 'Invite retrieved successfully.',
      success: true,
    };
  }

  async acceptInvite(userId: string, code: string): Promise<AcceptInviteResponse> {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        project: { select: { id: true, title: true } },
        creator: { select: { name: true } },
      },
    });

    if (!invite) {
      throw new NotFoundException('This invite code is not valid.');
    }

    if (invite.expiresAt < new Date()) {
      throw new GoneException('This invite has expired.');
    }

    // Accepting twice is a no-op success, not an error: the user's intent is
    // already satisfied, and failing here would make a double-tap look broken.
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: invite.projectId, userId } },
    });

    if (existing) {
      return {
        data: {
          projectId: invite.project.id,
          projectTitle: invite.project.title,
          role: existing.role,
          invitedBy: invite.creator.name,
        },
        message: 'You are already a member of this project.',
        success: true,
      };
    }

    if (invite.usedAt) {
      throw new GoneException('This invite has already been used.');
    }

    // One transaction so a race cannot seat a fourth member: the capacity count
    // and the insert are atomic, and marking the invite used is conditional on
    // it still being unused.
    const membership = await this.prisma.$transaction(async (tx) => {
      const memberCount = await tx.projectMember.count({
        where: { projectId: invite.projectId },
      });

      if (memberCount >= ProjectAccessService.MAX_MEMBERS) {
        throw new ForbiddenException(
          `This project already has the maximum of ${ProjectAccessService.MAX_MEMBERS} members.`,
        );
      }

      // Snapshot the joiner's name alongside the id, same as the creator.
      const joiner = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const claimed = await tx.projectInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: {
          usedAt: new Date(),
          usedBy: userId,
          usedByName: joiner?.name ?? null,
        },
      });

      // Another request claimed it between our read and this write.
      if (claimed.count === 0) {
        throw new GoneException('This invite has already been used.');
      }

      return tx.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId,
          role: ProjectRole.MEMBER,
        },
      });
    });

    this.logger.log(
      `"${invite.project.title}": ${userId} joined via invite ${invite.code} from ${invite.creator.name}.`,
    );

    return {
      data: {
        projectId: invite.project.id,
        projectTitle: invite.project.title,
        role: membership.role,
        invitedBy: invite.creator.name,
      },
      message: `You have joined "${invite.project.title}".`,
      success: true,
    };
  }

  async getMembers(userId: string, projectId: string): Promise<GetProjectMembersResponse> {
    await this.access.assertMember(userId, projectId);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
      // Owner first, then longest-standing member.
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return {
      data: members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        isSelf: member.userId === userId,
      })),
      message: 'Members retrieved successfully.',
      success: true,
    };
  }

  async removeMember(
    requesterId: string,
    projectId: string,
    targetUserId: string,
  ): Promise<RemoveMemberResponse> {
    await this.access.assertOwner(requesterId, projectId);

    // The owner leaving would strand the project with no one who can manage it.
    if (requesterId === targetUserId) {
      throw new ForbiddenException(
        'The owner cannot leave their own project. Transfer ownership or archive it instead.',
      );
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('That user is not a member of this project.');
    }

    await this.prisma.projectMember.delete({ where: { id: membership.id } });

    this.logger.log(`User ${targetUserId} removed from project ${projectId} by ${requesterId}.`);

    return {
      data: { userId: targetUserId },
      message: 'Member removed successfully.',
      success: true,
    };
  }
}
