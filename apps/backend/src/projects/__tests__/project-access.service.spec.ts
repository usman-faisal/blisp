import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectRole } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { ProjectAccessService } from '../project-access.service';

describe('ProjectAccessService', () => {
  let service: ProjectAccessService;

  const mockPrisma = {
    projectMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const USER = 'user_alice';
  const PROJECT = 'project-uuid-1';

  const ownerRow = {
    id: 'member-1',
    projectId: PROJECT,
    userId: USER,
    role: ProjectRole.OWNER,
    joinedAt: new Date('2026-07-01'),
  };

  const memberRow = { ...ownerRow, id: 'member-2', role: ProjectRole.MEMBER };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectAccessService>(ProjectAccessService);
  });

  describe('assertMember', () => {
    it('returns the membership row for a member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(memberRow);

      await expect(service.assertMember(USER, PROJECT)).resolves.toEqual(memberRow);
      expect(mockPrisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: PROJECT, userId: USER } },
      });
    });

    it('returns the membership row for an owner', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(ownerRow);

      await expect(service.assertMember(USER, PROJECT)).resolves.toEqual(ownerRow);
    });

    // The security-critical case: a non-member must never get through.
    it('throws NotFound when the user is not a member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.assertMember('user_stranger', PROJECT)).rejects.toThrow(
        NotFoundException,
      );
    });

    // NotFound rather than Forbidden, so a stranger cannot use the error to
    // discover that a project exists.
    it('does not reveal project existence to a non-member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.assertMember('user_stranger', PROJECT)).rejects.not.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertOwner', () => {
    it('returns the membership row for the owner', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(ownerRow);

      await expect(service.assertOwner(USER, PROJECT)).resolves.toEqual(ownerRow);
    });

    it('throws Forbidden for a non-owner member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(memberRow);

      await expect(service.assertOwner(USER, PROJECT)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for a non-member', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.assertOwner('user_stranger', PROJECT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('memberProjectIds', () => {
    it('returns the ids of every project the user belongs to', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([
        { projectId: 'p1' },
        { projectId: 'p2' },
      ]);

      await expect(service.memberProjectIds(USER)).resolves.toEqual(['p1', 'p2']);
      expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { userId: USER },
        select: { projectId: true },
      });
    });

    // An empty array must scope list queries to nothing, never to everything.
    it('returns an empty array when the user belongs to no projects', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([]);

      await expect(service.memberProjectIds(USER)).resolves.toEqual([]);
    });
  });

  describe('isMember', () => {
    it('is true when a membership row exists', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(1);

      await expect(service.isMember(USER, PROJECT)).resolves.toBe(true);
    });

    it('is false when no membership row exists', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(0);

      await expect(service.isMember(USER, PROJECT)).resolves.toBe(false);
    });
  });

  describe('assertHasCapacity', () => {
    it('resolves when the project has room', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(2);

      await expect(service.assertHasCapacity(PROJECT)).resolves.toBeUndefined();
    });

    it('throws when the project is exactly at the cap', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(ProjectAccessService.MAX_MEMBERS);

      await expect(service.assertHasCapacity(PROJECT)).rejects.toThrow(ForbiddenException);
    });

    // Guards against a race that let membership exceed the cap: the check must
    // reject when over, not only when exactly equal.
    it('throws when the project is somehow over the cap', async () => {
      mockPrisma.projectMember.count.mockResolvedValue(
        ProjectAccessService.MAX_MEMBERS + 1,
      );

      await expect(service.assertHasCapacity(PROJECT)).rejects.toThrow(ForbiddenException);
    });
  });
});
