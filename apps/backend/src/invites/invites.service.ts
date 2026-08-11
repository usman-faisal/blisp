import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InviteStatus, ProjectRole } from '@repo/db';
import {
  AcceptInviteResponse,
  AcceptTargetedInviteResponse,
  CreateInviteResponse,
  DeclineInviteResponse,
  GetInvitePreviewResponse,
  GetPendingInvitesResponse,
  GetProjectInvitesResponse,
  GetProjectMembersResponse,
  RemoveMemberResponse,
  RevokeInviteResponse,
  SendUserInviteResponse,
} from '@repo/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import {
  COLLABORATION_EVENTS,
  InviteDeclinedEvent,
  InviteReceivedEvent,
  MemberJoinedEvent,
} from 'src/notifications/events/collaboration.events';
import { SendUserInviteDto } from './dto/send-user-invite.dto';

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
    private readonly events: EventEmitter2,
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
          // `usedAt` stays the authority for the code flow, but leaving status at
          // its PENDING default would make a redeemed row contradict itself — the
          // same inconsistency the 8C migration backfilled away for existing
          // rows. The code column is untouched: it was set at creation.
          status: InviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // Another request claimed it between our read and this write.
      if (claimed.count === 0) {
        throw new GoneException('This invite has already been used.');
      }

      const created = await tx.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId,
          role: ProjectRole.MEMBER,
        },
      });

      return { ...created, joinerName: joiner?.name ?? 'A collaborator' };
    });

    this.logger.log(
      `"${invite.project.title}": ${userId} joined via invite ${invite.code} from ${invite.creator.name}.`,
    );

    // Emitted after the transaction commits, so a notification failure cannot
    // roll back the join. The listener handles its own errors.
    this.events.emit(
      COLLABORATION_EVENTS.MEMBER_JOINED,
      new MemberJoinedEvent(
        invite.projectId,
        invite.project.title,
        userId,
        membership.joinerName,
      ),
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

  /**
   * Sends an invite to one specific person, who answers it in-app.
   *
   * No code is minted: a targeted invite is bound to its recipient, so a
   * shareable code would be a second, unintended way into the project.
   */
  async sendUserInvite(
    inviterId: string,
    projectId: string,
    dto: SendUserInviteDto,
  ): Promise<SendUserInviteResponse> {
    // Any member may invite, same as the code flow. The cap limits growth.
    await this.access.assertMember(inviterId, projectId);
    // Counts pending invitations as well as members, so three invites cannot go
    // out for one free seat and leave the second acceptor holding the rejection.
    await this.access.assertHasCapacityForInvite(projectId);

    const recipient = dto.userId
      ? await this.prisma.user.findUnique({
          where: { id: dto.userId },
          select: { id: true, name: true, email: true },
        })
      : await this.prisma.user.findFirst({
          // equals, not contains — see UsersService.lookupUserByEmail.
          where: { email: { equals: dto.email!, mode: 'insensitive' } },
          select: { id: true, name: true, email: true },
        });

    if (!recipient) {
      throw new NotFoundException(
        dto.userId
          ? 'That user was not found.'
          : 'No account found with that email address.',
      );
    }

    if (recipient.id === inviterId) {
      throw new ConflictException('You are already on this project.');
    }

    // Checked before writing so the caller gets a precise reason rather than a
    // unique-constraint violation.
    if (await this.access.isMember(recipient.id, projectId)) {
      throw new ConflictException(
        `${recipient.name} is already a member of this project.`,
      );
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { name: true },
    });

    if (!inviter) {
      throw new NotFoundException('Your user record was not found.');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const existing = await this.prisma.projectInvite.findUnique({
      where: {
        projectId_invitedUserId: { projectId, invitedUserId: recipient.id },
      },
      select: { id: true, status: true, expiresAt: true },
    });

    // A live invite is not replaced — telling the sender it is already pending is
    // more useful than silently resetting the clock on it.
    if (
      existing?.status === InviteStatus.PENDING &&
      existing.expiresAt > new Date()
    ) {
      throw new ConflictException(
        `${recipient.name} already has a pending invitation to this project.`,
      );
    }

    // @@unique([projectId, invitedUserId]) means a declined or expired invite
    // occupies the slot, so re-inviting updates that row rather than inserting a
    // second one. Without this, one decline would block the person forever.
    const invite = existing
      ? await this.prisma.projectInvite.update({
          where: { id: existing.id },
          data: {
            status: InviteStatus.PENDING,
            expiresAt,
            respondedAt: null,
            createdBy: inviterId,
            createdByName: inviter.name,
            // Clear the code-flow columns in case this row was ever redeemed.
            usedAt: null,
            usedBy: null,
            usedByName: null,
          },
        })
      : await this.prisma.projectInvite.create({
          data: {
            projectId,
            // Deliberately null; see the method comment.
            code: null,
            createdBy: inviterId,
            createdByName: inviter.name,
            invitedUserId: recipient.id,
            status: InviteStatus.PENDING,
            expiresAt,
          },
        });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true },
    });

    this.logger.log(
      `Invite ${invite.id} sent to ${recipient.email} for project ${projectId} by ${inviterId}.`,
    );

    // After the write, so a notification failure cannot lose the invite.
    this.events.emit(
      COLLABORATION_EVENTS.INVITE_RECEIVED,
      new InviteReceivedEvent(
        invite.id,
        projectId,
        project?.title ?? 'a project',
        recipient.id,
        inviter.name,
      ),
    );

    return {
      data: {
        id: invite.id,
        projectId,
        projectTitle: project?.title ?? '',
        status: invite.status,
        invitedBy: inviter.name,
        invitedUserId: recipient.id,
        invitedUserName: recipient.name,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      },
      message: `Invitation sent to ${recipient.name}.`,
      success: true,
    };
  }

  /** Invites addressed to the current user and still awaiting an answer. */
  async getPendingInvites(userId: string): Promise<GetPendingInvitesResponse> {
    const invites = await this.prisma.projectInvite.findMany({
      where: {
        invitedUserId: userId,
        status: InviteStatus.PENDING,
        // Expiry is derived at read time rather than stamped on the row, so a
        // lapsed invite simply stops appearing.
        expiresAt: { gt: new Date() },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: invites.map((invite) => ({
        id: invite.id,
        projectId: invite.project.id,
        projectTitle: invite.project.title,
        projectDescription: invite.project.description,
        memberCount: invite.project._count.members,
        invitedBy: invite.createdByName,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
      })),
      message: 'Pending invitations retrieved successfully.',
      success: true,
    };
  }

  /** Outgoing invites for a project, so the UI can show "awaiting reply". */
  async getProjectInvites(
    userId: string,
    projectId: string,
  ): Promise<GetProjectInvitesResponse> {
    await this.access.assertMember(userId, projectId);

    const invites = await this.prisma.projectInvite.findMany({
      where: {
        projectId,
        // Code invites have no recipient to report on.
        invitedUserId: { not: null },
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: { invitedUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: invites.map((invite) => ({
        id: invite.id,
        status: invite.status,
        invitedUserId: invite.invitedUserId!,
        invitedUserName: invite.invitedUser?.name ?? 'Unknown',
        invitedUserEmail: invite.invitedUser?.email ?? '',
        invitedBy: invite.createdByName,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        respondedAt: invite.respondedAt?.toISOString() ?? null,
      })),
      message: 'Project invitations retrieved successfully.',
      success: true,
    };
  }

  /**
   * Accepts a targeted invite by id.
   *
   * Separate from acceptInvite (which takes a code) rather than overloading one
   * route: a targeted invite has no code, and disambiguating two same-shaped
   * paths by whether the parameter parses as a UUID would make an invalid id
   * fall through to the wrong handler.
   */
  async acceptTargetedInvite(
    userId: string,
    inviteId: string,
  ): Promise<AcceptTargetedInviteResponse> {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: inviteId },
      include: { project: { select: { id: true, title: true } } },
    });

    // NotFound rather than Forbidden for someone else's invite, matching
    // ProjectAccessService.assertMember: 403 would confirm the invite exists.
    if (!invite || invite.invitedUserId !== userId) {
      throw new NotFoundException('This invitation was not found.');
    }

    // Double-tap is a no-op success, as in the code flow.
    if (invite.status === InviteStatus.ACCEPTED) {
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: invite.projectId, userId } },
      });

      return {
        data: {
          projectId: invite.project.id,
          projectTitle: invite.project.title,
          role: membership?.role ?? ProjectRole.MEMBER,
          invitedBy: invite.createdByName,
        },
        message: 'You are already a member of this project.',
        success: true,
      };
    }

    // Distinct from expiry so the UI can say which happened.
    if (invite.status === InviteStatus.DECLINED) {
      throw new GoneException('You have already declined this invitation.');
    }

    if (invite.status === InviteStatus.REVOKED) {
      throw new GoneException('This invitation was withdrawn.');
    }

    if (invite.expiresAt < new Date()) {
      throw new GoneException('This invitation has expired.');
    }

    // Capacity is re-checked *inside* the transaction, not just on send: pending
    // invites deliberately do not reserve a seat, so three pending invites on a
    // one-member project are all legal and the last accept must lose.
    const membership = await this.prisma.$transaction(async (tx) => {
      const memberCount = await tx.projectMember.count({
        where: { projectId: invite.projectId },
      });

      if (memberCount >= ProjectAccessService.MAX_MEMBERS) {
        throw new ForbiddenException(
          `This project already has the maximum of ${ProjectAccessService.MAX_MEMBERS} members.`,
        );
      }

      const joiner = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      // Conditional on still being PENDING, so two simultaneous accepts cannot
      // both proceed — the same guard the code flow uses on usedAt.
      const claimed = await tx.projectInvite.updateMany({
        where: { id: invite.id, status: InviteStatus.PENDING },
        data: {
          status: InviteStatus.ACCEPTED,
          respondedAt: new Date(),
          // Kept in step with the code flow's columns so a row reads the same
          // either way it was redeemed.
          usedAt: new Date(),
          usedBy: userId,
          usedByName: joiner?.name ?? null,
        },
      });

      if (claimed.count === 0) {
        throw new GoneException('This invitation is no longer valid.');
      }

      const created = await tx.projectMember.create({
        data: {
          projectId: invite.projectId,
          userId,
          role: ProjectRole.MEMBER,
        },
      });

      return { ...created, joinerName: joiner?.name ?? 'A collaborator' };
    });

    this.logger.log(
      `"${invite.project.title}": ${userId} accepted invite ${invite.id} from ${invite.createdByName}.`,
    );

    // Reuses Phase 5's join event, so existing members still hear about it.
    this.events.emit(
      COLLABORATION_EVENTS.MEMBER_JOINED,
      new MemberJoinedEvent(
        invite.projectId,
        invite.project.title,
        userId,
        membership.joinerName,
      ),
    );

    return {
      data: {
        projectId: invite.project.id,
        projectTitle: invite.project.title,
        role: membership.role,
        invitedBy: invite.createdByName,
      },
      message: `You have joined "${invite.project.title}".`,
      success: true,
    };
  }

  /** Declines a targeted invite. Only the sender is told. */
  async declineInvite(userId: string, inviteId: string): Promise<DeclineInviteResponse> {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: inviteId },
      include: { project: { select: { title: true } } },
    });

    if (!invite || invite.invitedUserId !== userId) {
      throw new NotFoundException('This invitation was not found.');
    }

    // Declining twice is a no-op success: the intent is already recorded.
    if (invite.status === InviteStatus.DECLINED) {
      return {
        data: { id: invite.id },
        message: 'Invitation already declined.',
        success: true,
      };
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      throw new ConflictException(
        'You have already joined this project. Leave it instead.',
      );
    }

    if (invite.status === InviteStatus.REVOKED) {
      throw new GoneException('This invitation was withdrawn.');
    }

    const decliner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await this.prisma.projectInvite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.DECLINED, respondedAt: new Date() },
    });

    this.logger.log(`Invite ${invite.id} declined by ${userId}.`);

    this.events.emit(
      COLLABORATION_EVENTS.INVITE_DECLINED,
      new InviteDeclinedEvent(
        invite.projectId,
        invite.project.title,
        invite.createdBy,
        decliner?.name ?? 'Someone',
      ),
    );

    return {
      data: { id: invite.id },
      message: 'Invitation declined.',
      success: true,
    };
  }

  /**
   * Withdraws a pending invite. The sender or the project owner may do this —
   * the owner needs to be able to undo an invite a member sent.
   *
   * Deleting the row rather than marking it REVOKED, so the notification
   * carrying its accept/decline buttons cascades away with it. A REVOKED row
   * would leave a live-looking notification whose buttons return 410.
   */
  async revokeInvite(userId: string, inviteId: string): Promise<RevokeInviteResponse> {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, projectId: true, createdBy: true, status: true },
    });

    if (!invite) {
      throw new NotFoundException('This invitation was not found.');
    }

    // Membership first: a non-member must not learn whether the invite exists.
    const membership = await this.access.assertMember(userId, invite.projectId);

    const isSender = invite.createdBy === userId;
    const isOwner = membership.role === ProjectRole.OWNER;

    if (!isSender && !isOwner) {
      throw new ForbiddenException(
        'Only the person who sent this invitation, or the project owner, can withdraw it.',
      );
    }

    if (invite.status === InviteStatus.ACCEPTED) {
      throw new ConflictException(
        'That invitation was already accepted. Remove the member instead.',
      );
    }

    await this.prisma.projectInvite.delete({ where: { id: invite.id } });

    this.logger.log(`Invite ${invite.id} withdrawn by ${userId}.`);

    return {
      data: { id: invite.id },
      message: 'Invitation withdrawn.',
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

    // Unassign their tasks in the same transaction as the removal, so the work
    // returns to the shared backlog rather than being orphaned on a non-member.
    // The FK is ON DELETE SetNull, but that only fires if the *user* is deleted
    // — losing project membership does not touch it.
    const [, unassigned] = await this.prisma.$transaction([
      this.prisma.projectMember.delete({ where: { id: membership.id } }),
      this.prisma.task.updateMany({
        where: { projectId, assigneeId: targetUserId },
        data: { assigneeId: null, assigneeName: null },
      }),
    ]);

    this.logger.log(
      `User ${targetUserId} removed from project ${projectId} by ${requesterId}. ` +
        `${unassigned.count} task(s) returned to the backlog.`,
    );

    return {
      data: { userId: targetUserId },
      message: 'Member removed successfully.',
      success: true,
    };
  }
}
