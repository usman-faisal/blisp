import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { InvitesService } from '../invites.service';

describe('InvitesService', () => {
  let service: InvitesService;

  const mockPrisma = {
    projectInvite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    // Runs the callback against the same mocks, so transaction bodies are tested.
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    assertHasCapacity: jest.fn(),
    isMember: jest.fn(),
    memberProjectIds: jest.fn(),
  };

  const OWNER = 'user_owner';
  const JOINER = 'user_joiner';
  const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CODE = 'ABCD2345';

  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  const invite = {
    id: 'invite-1',
    projectId: PROJECT,
    code: CODE,
    createdBy: OWNER,
    expiresAt: future,
    usedAt: null as Date | null,
    usedBy: null as string | null,
    project: { id: PROJECT, title: 'Shared roadmap', description: 'desc', _count: { members: 1 } },
    // Joined via the creator relation, so who invited whom is readable without
    // resolving a raw Clerk id.
    creator: { name: 'Alice' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
      ],
    }).compile();

    service = module.get<InvitesService>(InvitesService);
  });

  describe('createInvite', () => {
    it('creates a code for a member and returns a deep link', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });
      mockAccess.assertHasCapacity.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice' });
      mockPrisma.projectInvite.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'invite-1' }),
      );

      const result = await service.createInvite(OWNER, PROJECT);

      expect(result.data.code).toHaveLength(8);
      expect(result.data.shareUrl).toBe(`blisp://invite/${result.data.code}`);
      expect(mockAccess.assertMember).toHaveBeenCalledWith(OWNER, PROJECT);
    });

    // Don't hand out a code that cannot be redeemed.
    it('refuses when the project is already full', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
      mockAccess.assertHasCapacity.mockRejectedValue(new ForbiddenException());

      await expect(service.createInvite(OWNER, PROJECT)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.projectInvite.create).not.toHaveBeenCalled();
    });

    it('rejects a non-member', async () => {
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(service.createInvite('user_stranger', PROJECT)).rejects.toThrow(
        NotFoundException,
      );
    });

    // Codes are read aloud and typed by hand, so confusable characters are out.
    it('generates codes without visually ambiguous characters', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });
      mockAccess.assertHasCapacity.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice' });
      mockPrisma.projectInvite.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'x' }),
      );

      for (let i = 0; i < 25; i++) {
        const { data } = await service.createInvite(OWNER, PROJECT);
        expect(data.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
      }
    });

    // The snapshot is what makes an invite row readable in Studio/logs without
    // joining to "User".
    it('snapshots the inviter name onto the row', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });
      mockAccess.assertHasCapacity.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice' });
      mockPrisma.projectInvite.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...data, id: 'invite-1' }),
      );

      await service.createInvite(OWNER, PROJECT);

      expect(mockPrisma.projectInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdByName: 'Alice', createdBy: OWNER }),
        }),
      );
    });

    it('retries when a generated code collides', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.OWNER });
      mockAccess.assertHasCapacity.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice' });
      mockPrisma.projectInvite.create
        .mockRejectedValueOnce(new Error('unique constraint violation'))
        .mockImplementation(({ data }: any) => Promise.resolve({ ...data, id: 'invite-2' }));

      const result = await service.createInvite(OWNER, PROJECT);

      expect(result.success).toBe(true);
      expect(mockPrisma.projectInvite.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getInvitePreview', () => {
    it('returns project details without joining', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockAccess.isMember.mockResolvedValue(false);

      const result = await service.getInvitePreview(JOINER, CODE);

      expect(result.data.projectTitle).toBe('Shared roadmap');
      expect(result.data.invitedBy).toBe('Alice');
      expect(result.data.alreadyMember).toBe(false);
      // Preview must not create a membership.
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('accepts a lowercase code', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockAccess.isMember.mockResolvedValue(false);

      await service.getInvitePreview(JOINER, CODE.toLowerCase());

      expect(mockPrisma.projectInvite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: CODE } }),
      );
    });

    it('throws NotFound for an unknown code', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(null);

      await expect(service.getInvitePreview(JOINER, 'NOPE1234')).rejects.toThrow(
        NotFoundException,
      );
    });

    // Used and expired must be distinguishable, so the UI can explain which.
    it('throws Gone with a "used" message for a consumed invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({ ...invite, usedAt: past });

      await expect(service.getInvitePreview(JOINER, CODE)).rejects.toThrow(
        /already been used/,
      );
    });

    it('throws Gone with an "expired" message for a stale invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({ ...invite, expiresAt: past });

      await expect(service.getInvitePreview(JOINER, CODE)).rejects.toThrow(/expired/);
    });

    it('flags a requester who already belongs', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockAccess.isMember.mockResolvedValue(true);

      const result = await service.getInvitePreview(OWNER, CODE);

      expect(result.data.alreadyMember).toBe(true);
    });

    // The inviter's name comes from the joined relation, not a second query.
    it('reads the inviter name from the creator relation', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockAccess.isMember.mockResolvedValue(false);

      const result = await service.getInvitePreview(JOINER, CODE);

      expect(result.data.invitedBy).toBe('Alice');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.projectInvite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ creator: { select: { name: true } } }),
        }),
      );
    });
  });

  describe('acceptInvite', () => {
    it('adds the user as a MEMBER', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.count.mockResolvedValue(1);
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.create.mockResolvedValue({
        id: 'member-2',
        projectId: PROJECT,
        userId: JOINER,
        role: ProjectRole.MEMBER,
      });

      const result = await service.acceptInvite(JOINER, CODE);

      expect(result.data.role).toBe(ProjectRole.MEMBER);
      expect(result.data.projectId).toBe(PROJECT);
      // The joiner should see who invited them, not a raw Clerk id.
      expect(result.data.invitedBy).toBe('Alice');
    });

    // A double-tap should not surface as an error.
    it('is a no-op success when the user already belongs', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        id: 'member-1',
        role: ProjectRole.MEMBER,
      });

      const result = await service.acceptInvite(JOINER, CODE);

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/already a member/);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('enforces the member cap inside the transaction', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.count.mockResolvedValue(ProjectAccessService.MAX_MEMBERS);

      await expect(service.acceptInvite(JOINER, CODE)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    // The race: two users accept the same single-use invite at once. The
    // conditional update means exactly one wins.
    it('rejects the loser of a concurrent claim', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.count.mockResolvedValue(1);
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptInvite(JOINER, CODE)).rejects.toThrow(GoneException);
      expect(mockPrisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('snapshots the joiner name when claiming the invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.count.mockResolvedValue(1);
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Bob' });
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.create.mockResolvedValue({ role: ProjectRole.MEMBER });

      await service.acceptInvite(JOINER, CODE);

      expect(mockPrisma.projectInvite.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usedBy: JOINER, usedByName: 'Bob' }),
        }),
      );
    });

    it('claims the invite conditionally on it still being unused', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue(invite);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.projectMember.count.mockResolvedValue(1);
      mockPrisma.projectInvite.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectMember.create.mockResolvedValue({ role: ProjectRole.MEMBER });

      await service.acceptInvite(JOINER, CODE);

      expect(mockPrisma.projectInvite.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: invite.id, usedAt: null } }),
      );
    });

    it('rejects an expired invite', async () => {
      mockPrisma.projectInvite.findUnique.mockResolvedValue({ ...invite, expiresAt: past });

      await expect(service.acceptInvite(JOINER, CODE)).rejects.toThrow(GoneException);
    });
  });

  describe('getMembers', () => {
    it('marks the requesting user with isSelf', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: ProjectRole.MEMBER });
      mockPrisma.projectMember.findMany.mockResolvedValue([
        {
          userId: OWNER,
          role: ProjectRole.OWNER,
          joinedAt: past,
          user: { name: 'Alice', email: 'alice@example.com' },
        },
        {
          userId: JOINER,
          role: ProjectRole.MEMBER,
          joinedAt: future,
          user: { name: 'Bob', email: 'bob@example.com' },
        },
      ]);

      const result = await service.getMembers(JOINER, PROJECT);

      expect(result.data).toHaveLength(2);
      expect(result.data.find((m) => m.userId === JOINER)?.isSelf).toBe(true);
      expect(result.data.find((m) => m.userId === OWNER)?.isSelf).toBe(false);
    });

    it('rejects a non-member', async () => {
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(service.getMembers('user_stranger', PROJECT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeMember', () => {
    it('lets the owner remove a member', async () => {
      mockAccess.assertOwner.mockResolvedValue({ role: ProjectRole.OWNER });
      mockPrisma.projectMember.findUnique.mockResolvedValue({ id: 'member-2' });
      mockPrisma.projectMember.delete.mockResolvedValue({});

      const result = await service.removeMember(OWNER, PROJECT, JOINER);

      expect(result.data.userId).toBe(JOINER);
      expect(mockPrisma.projectMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-2' },
      });
    });

    it('rejects a non-owner', async () => {
      mockAccess.assertOwner.mockRejectedValue(new ForbiddenException());

      await expect(service.removeMember(JOINER, PROJECT, OWNER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.projectMember.delete).not.toHaveBeenCalled();
    });

    // Removing the owner would strand the project with nobody who can manage it.
    it('refuses to let the owner remove themselves', async () => {
      mockAccess.assertOwner.mockResolvedValue({ role: ProjectRole.OWNER });

      await expect(service.removeMember(OWNER, PROJECT, OWNER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.projectMember.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound when the target is not a member', async () => {
      mockAccess.assertOwner.mockResolvedValue({ role: ProjectRole.OWNER });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(OWNER, PROJECT, 'user_nobody')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
