import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InviteStatus, ProjectRole } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { COLLABORATION_EVENTS } from 'src/notifications/events/collaboration.events';
import { InvitesService } from '../invites.service';

/**
 * Slice 8C: invites addressed to one person and answered in-app.
 *
 * Kept in its own file so the 23 code-flow specs stay untouched — the two flows
 * share a table and must not share test setup, or a regression in one could be
 * masked by a fixture written for the other.
 */
describe('InvitesService — targeted invites', () => {
  let service: InvitesService;
  let events: { emit: jest.Mock };

  const mockPrisma = {
    projectInvite: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    project: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma),
    ),
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    assertHasCapacity: jest.fn(),
    isMember: jest.fn(),
  };

  const INVITER = 'user_inviter';
  const RECIPIENT = 'user_recipient';
  const STRANGER = 'user_stranger';
  const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const INVITE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  const recipientUser = {
    id: RECIPIENT,
    name: 'Recipient',
    email: 'recipient@example.com',
  };

  /** A pending targeted invite as findUnique returns it. */
  const pendingInvite = (overrides: Record<string, unknown> = {}) => ({
    id: INVITE_ID,
    projectId: PROJECT,
    code: null,
    createdBy: INVITER,
    createdByName: 'Inviter',
    invitedUserId: RECIPIENT,
    status: InviteStatus.PENDING,
    expiresAt: future,
    respondedAt: null,
    createdAt: new Date(),
    project: { id: PROJECT, title: 'Shared roadmap' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockPrisma),
    );

    mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });
    mockAccess.assertHasCapacity.mockResolvedValue(undefined);
    mockAccess.isMember.mockResolvedValue(false);

    mockPrisma.project.findUnique.mockResolvedValue({ title: 'Shared roadmap' });
    mockPrisma.projectInvite.findUnique.mockResolvedValue(null);
    mockPrisma.projectMember.count.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(InvitesService);
    events = module.get(EventEmitter2) as any;
  });

  describe('sendUserInvite', () => {
    beforeEach(() => {
      // First call resolves the recipient, second the inviter.
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(recipientUser)
        .mockResolvedValueOnce({ name: 'Inviter' });
      mockPrisma.projectInvite.create.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: future,
        createdAt: new Date(),
      });
    });

    it('creates a PENDING invite for the recipient', async () => {
      const result = await service.sendUserInvite(INVITER, PROJECT, {
        userId: RECIPIENT,
      });

      expect(mockPrisma.projectInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: PROJECT,
          invitedUserId: RECIPIENT,
          status: InviteStatus.PENDING,
        }),
      });
      expect(result.data.status).toBe(InviteStatus.PENDING);
    });

    // A shareable code would be a second, unintended way into the project.
    it('mints no invite code', async () => {
      await service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT });

      expect(mockPrisma.projectInvite.create.mock.calls[0][0].data.code).toBeNull();
    });

    // The notification must carry inviteId or the row cannot offer accept/decline.
    it('emits an actionable invite event', async () => {
      await service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT });

      expect(events.emit).toHaveBeenCalledWith(
        COLLABORATION_EVENTS.INVITE_RECEIVED,
        expect.objectContaining({
          inviteId: INVITE_ID,
          invitedUserId: RECIPIENT,
          inviterName: 'Inviter',
        }),
      );
    });

    it('resolves the recipient by email when no id is given', async () => {
      mockPrisma.user.findUnique.mockReset();
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Inviter' });
      mockPrisma.user.findFirst.mockResolvedValue(recipientUser);

      await service.sendUserInvite(INVITER, PROJECT, {
        email: 'recipient@example.com',
      });

      // equals, not contains: the same non-enumeration rule as the 8B lookup.
      expect(mockPrisma.user.findFirst.mock.calls[0][0].where.email).toEqual({
        equals: 'recipient@example.com',
        mode: 'insensitive',
      });
    });

    it('rejects an unknown recipient', async () => {
      mockPrisma.user.findUnique.mockReset();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.sendUserInvite(INVITER, PROJECT, { userId: 'user_ghost' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects inviting yourself', async () => {
      mockPrisma.user.findUnique.mockReset();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: INVITER,
        name: 'Inviter',
        email: 'inviter@example.com',
      });

      await expect(
        service.sendUserInvite(INVITER, PROJECT, { userId: INVITER }),
      ).rejects.toThrow(ConflictException);
    });

    // A precise reason beats a unique-constraint violation.
    it('rejects inviting an existing member', async () => {
      mockAccess.isMember.mockResolvedValue(true);

      await expect(
        service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT }),
      ).rejects.toThrow(/already a member/i);
    });

    it('rejects when the project is full', async () => {
      mockAccess.assertHasCapacity.mockRejectedValue(
        new ForbiddenException('full'),
      );

      await expect(
        service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate while one is still pending', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: future,
      });

      await expect(
        service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT }),
      ).rejects.toThrow(/already has a pending invitation/i);
      expect(mockPrisma.projectInvite.create).not.toHaveBeenCalled();
    });

    /**
     * The consequence of @@unique([projectId, invitedUserId]): a declined invite
     * occupies the slot, so without reusing the row one decline would block the
     * person from ever being invited again.
     */
    it('reuses the row when re-inviting after a decline', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.DECLINED,
        expiresAt: future,
      });
      mockPrisma.projectInvite.update.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: future,
        createdAt: new Date(),
      });

      await service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT });

      expect(mockPrisma.projectInvite.create).not.toHaveBeenCalled();
      expect(mockPrisma.projectInvite.update).toHaveBeenCalledWith({
        where: { id: INVITE_ID },
        data: expect.objectContaining({
          status: InviteStatus.PENDING,
          respondedAt: null,
        }),
      });
    });

    it('reuses the row when re-inviting after expiry', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: past,
      });
      mockPrisma.projectInvite.update.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: future,
        createdAt: new Date(),
      });

      await service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT });

      expect(mockPrisma.projectInvite.update).toHaveBeenCalled();
    });

    // A reused row may carry stale code-flow columns from a previous redemption.
    it('clears the code-flow columns when reusing a row', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.DECLINED,
        expiresAt: future,
      });
      mockPrisma.projectInvite.update.mockResolvedValue({
        id: INVITE_ID,
        status: InviteStatus.PENDING,
        expiresAt: future,
        createdAt: new Date(),
      });

      await service.sendUserInvite(INVITER, PROJECT, { userId: RECIPIENT });

      expect(mockPrisma.projectInvite.update.mock.calls[0][0].data).toMatchObject({
        usedAt: null,
        usedBy: null,
        usedByName: null,
      });
    });
  });

  describe('acceptTargetedInvite', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Recipient' });
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.create.mockResolvedValue({
        role: ProjectRole.MEMBER,
      });
    });

    it('joins the project and marks the invite accepted', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(pendingInvite());

      const result = await service.acceptTargetedInvite(RECIPIENT, INVITE_ID);

      expect(mockPrisma.projectInvite.updateMany).toHaveBeenCalledWith({
        where: { id: INVITE_ID, status: InviteStatus.PENDING },
        data: expect.objectContaining({ status: InviteStatus.ACCEPTED }),
      });
      expect(mockPrisma.projectMember.create).toHaveBeenCalledWith({
        data: { projectId: PROJECT, userId: RECIPIENT, role: ProjectRole.MEMBER },
      });
      expect(result.data.projectTitle).toBe('Shared roadmap');
    });

    // Phase 5's join notification must still fire for a targeted accept.
    it('emits MemberJoined so existing members hear about it', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(pendingInvite());

      await service.acceptTargetedInvite(RECIPIENT, INVITE_ID);

      expect(events.emit).toHaveBeenCalledWith(
        COLLABORATION_EVENTS.MEMBER_JOINED,
        expect.objectContaining({ joinerId: RECIPIENT, projectId: PROJECT }),
      );
    });

    // NotFound, not Forbidden: 403 would confirm the invite exists.
    it('rejects a non-recipient with NotFound', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(pendingInvite());

      await expect(
        service.acceptTargetedInvite(STRANGER, INVITE_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('rejects a missing invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an expired invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ expiresAt: past }),
      );

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(GoneException);
    });

    it('rejects a declined invite distinctly', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ status: InviteStatus.DECLINED }),
      );

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(/already declined/i);
    });

    it('rejects a withdrawn invite distinctly', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ status: InviteStatus.REVOKED }),
      );

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(/withdrawn/i);
    });

    // Double-tap must not read as an error.
    it('treats an already-accepted invite as a no-op success', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ status: InviteStatus.ACCEPTED }),
      );
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        role: ProjectRole.MEMBER,
      });

      const result = await service.acceptTargetedInvite(RECIPIENT, INVITE_ID);

      expect(result.success).toBe(true);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    /**
     * Pending invites deliberately do not reserve a seat, so the cap can only be
     * enforced at accept time. Three pending invites on a one-member project are
     * all legal and the last accept has to lose.
     */
    it('re-checks capacity inside the transaction', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(pendingInvite());
      mockPrisma.projectMember.count.mockResolvedValue(
        ProjectAccessService.MAX_MEMBERS,
      );

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    // Two simultaneous accepts: the conditional update means one sees count 0.
    it('loses the race when another request claimed it first', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(pendingInvite());
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.acceptTargetedInvite(RECIPIENT, INVITE_ID),
      ).rejects.toThrow(GoneException);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });
  });

  describe('declineInvite', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Recipient' });
      mockPrisma.projectInvite.update.mockResolvedValue({ id: INVITE_ID });
    });

    it('marks the invite declined without creating a membership', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ project: { title: 'Shared roadmap' } }),
      );

      await service.declineInvite(RECIPIENT, INVITE_ID);

      expect(mockPrisma.projectInvite.update).toHaveBeenCalledWith({
        where: { id: INVITE_ID },
        data: expect.objectContaining({ status: InviteStatus.DECLINED }),
      });
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('notifies the sender', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ project: { title: 'Shared roadmap' } }),
      );

      await service.declineInvite(RECIPIENT, INVITE_ID);

      expect(events.emit).toHaveBeenCalledWith(
        COLLABORATION_EVENTS.INVITE_DECLINED,
        expect.objectContaining({ inviterId: INVITER, declinerName: 'Recipient' }),
      );
    });

    it('rejects a non-recipient', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ project: { title: 'X' } }),
      );

      await expect(service.declineInvite(STRANGER, INVITE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('treats a second decline as a no-op success', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ status: InviteStatus.DECLINED, project: { title: 'X' } }),
      );

      const result = await service.declineInvite(RECIPIENT, INVITE_ID);

      expect(result.success).toBe(true);
      expect(mockPrisma.projectInvite.update).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('refuses to decline an invite already accepted', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(
        pendingInvite({ status: InviteStatus.ACCEPTED, project: { title: 'X' } }),
      );

      await expect(service.declineInvite(RECIPIENT, INVITE_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('revokeInvite', () => {
    const revocable = {
      id: INVITE_ID,
      projectId: PROJECT,
      createdBy: INVITER,
      status: InviteStatus.PENDING,
    };

    it('lets the sender withdraw it', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(revocable);
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });

      await service.revokeInvite(INVITER, INVITE_ID);

      expect(mockPrisma.projectInvite.delete).toHaveBeenCalledWith({
        where: { id: INVITE_ID },
      });
    });

    // The owner needs to be able to undo an invite a member sent.
    it('lets the project owner withdraw someone else’s invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(revocable);
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });

      await service.revokeInvite('user_owner', INVITE_ID);

      expect(mockPrisma.projectInvite.delete).toHaveBeenCalled();
    });

    it('refuses an unrelated member', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(revocable);
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });

      await expect(service.revokeInvite(STRANGER, INVITE_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.projectInvite.delete).not.toHaveBeenCalled();
    });

    // A non-member must not learn whether the invite exists.
    it('checks membership before revealing anything', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(revocable);
      mockAccess.assertMember.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(service.revokeInvite(STRANGER, INVITE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to withdraw an accepted invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({
        ...revocable,
        status: InviteStatus.ACCEPTED,
      });

      await expect(service.revokeInvite(INVITER, INVITE_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    /**
     * Deleted, not marked REVOKED, so the notification carrying its
     * accept/decline buttons cascades away. A REVOKED row would leave a
     * live-looking notification whose buttons return 410.
     */
    it('deletes the row so the notification cascades', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(revocable);

      await service.revokeInvite(INVITER, INVITE_ID);

      expect(mockPrisma.projectInvite.delete).toHaveBeenCalled();
      expect(mockPrisma.projectInvite.update).not.toHaveBeenCalled();
    });
  });

  describe('getPendingInvites', () => {
    it('returns only my pending, unexpired invites', async () => {
      mockPrisma.projectInvite.findMany.mockResolvedValue([]);

      await service.getPendingInvites(RECIPIENT);

      expect(mockPrisma.projectInvite.findMany.mock.calls[0][0].where).toEqual({
        invitedUserId: RECIPIENT,
        status: InviteStatus.PENDING,
        expiresAt: { gt: expect.any(Date) },
      });
    });

    it('maps the project and inviter for display', async () => {
      mockPrisma.projectInvite.findMany.mockResolvedValue([
        {
          id: INVITE_ID,
          createdByName: 'Inviter',
          expiresAt: future,
          createdAt: new Date(),
          project: {
            id: PROJECT,
            title: 'Shared roadmap',
            description: 'Desc',
            _count: { members: 2 },
          },
        },
      ]);

      const result = await service.getPendingInvites(RECIPIENT);

      expect(result.data[0]).toMatchObject({
        projectTitle: 'Shared roadmap',
        memberCount: 2,
        invitedBy: 'Inviter',
      });
    });
  });

  describe('getProjectInvites', () => {
    it('requires membership', async () => {
      mockAccess.assertMember.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(service.getProjectInvites(STRANGER, PROJECT)).rejects.toThrow(
        NotFoundException,
      );
    });

    // Code invites have no recipient to report on.
    it('excludes code invites', async () => {
      mockPrisma.projectInvite.findMany.mockResolvedValue([]);

      await service.getProjectInvites(INVITER, PROJECT);

      expect(
        mockPrisma.projectInvite.findMany.mock.calls[0][0].where.invitedUserId,
      ).toEqual({ not: null });
    });
  });
});
