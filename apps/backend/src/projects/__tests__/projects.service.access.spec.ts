import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { DailyPlanCronService } from 'src/daily_plan/daily-plan.service';
import { ProjectAccessService } from '../project-access.service';
import { ProjectsService } from '../projects.service';

/**
 * Phase 2 access-control contract for ProjectsService.
 *
 * Access used to be a `where: { id, userId }` filter. These tests pin the
 * replacement: authorisation goes through ProjectAccessService, reads are
 * open to any member, and destructive operations stay owner-only.
 */
describe('ProjectsService — membership access', () => {
  let service: ProjectsService;

  const mockPrisma = {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockAccess = {
    assertMember: jest.fn(),
    assertOwner: jest.fn(),
    memberProjectIds: jest.fn(),
    isMember: jest.fn(),
  };

  const mockDailyPlan = { processUserPlan: jest.fn().mockResolvedValue(undefined) };

  const OWNER = 'user_owner';
  const MEMBER = 'user_member';
  const STRANGER = 'user_stranger';
  const PROJECT = 'project-1';

  const project = {
    id: PROJECT,
    userId: OWNER,
    title: 'Shared roadmap',
    description: 'desc',
    techStack: ['ts'],
    status: ProjectStatus.INCUBATOR,
    classification: 'PROJECT',
    resources: [],
    tasks: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: DailyPlanCronService, useValue: mockDailyPlan },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('getProjectById', () => {
    it('lets a member read a project they did not create', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);

      const result = await service.getProjectById(MEMBER, PROJECT);

      expect(result.data.id).toBe(PROJECT);
      expect(mockAccess.assertMember).toHaveBeenCalledWith(MEMBER, PROJECT);
    });

    // The regression that matters: the query must no longer filter on userId,
    // or members would still be locked out of projects they did not create.
    it('does not scope the lookup by userId', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);

      await service.getProjectById(MEMBER, PROJECT);

      const where = mockPrisma.project.findUnique.mock.calls[0][0].where;
      expect(where).toEqual({ id: PROJECT });
      expect(where).not.toHaveProperty('userId');
    });

    it('propagates the access check failure for a non-member', async () => {
      mockAccess.assertMember.mockRejectedValue(new NotFoundException());

      await expect(service.getProjectById(STRANGER, PROJECT)).rejects.toThrow(
        NotFoundException,
      );
      // The project must never be read when the check fails.
      expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getProjects', () => {
    it('lists every project the user is a member of', async () => {
      mockAccess.memberProjectIds.mockResolvedValue(['p1', 'p2']);
      mockPrisma.project.findMany.mockResolvedValue([]);

      await service.getProjects(MEMBER);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['p1', 'p2'] } } }),
      );
    });

    // Scoping to an empty set must return nothing, never everything.
    it('returns no projects when the user has no memberships', async () => {
      mockAccess.memberProjectIds.mockResolvedValue([]);
      mockPrisma.project.findMany.mockResolvedValue([]);

      const result = await service.getProjects(STRANGER);

      expect(result.data).toEqual([]);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [] } } }),
      );
    });

    it('keeps the status filter alongside the membership scope', async () => {
      mockAccess.memberProjectIds.mockResolvedValue(['p1']);
      mockPrisma.project.findMany.mockResolvedValue([]);

      await service.getProjects(MEMBER, ProjectStatus.ACTIVE);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['p1'] }, status: ProjectStatus.ACTIVE },
        }),
      );
    });
  });

  describe('archiveProject', () => {
    // Archiving hides the project from everyone, so it must stay owner-only.
    it('requires ownership, not just membership', async () => {
      mockAccess.assertOwner.mockRejectedValue(new ForbiddenException());

      await expect(service.archiveProject(MEMBER, PROJECT)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAccess.assertOwner).toHaveBeenCalledWith(MEMBER, PROJECT);
      expect(mockPrisma.project.update).not.toHaveBeenCalled();
    });

    it('lets the owner archive', async () => {
      mockAccess.assertOwner.mockResolvedValue({ role: 'OWNER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);
      mockPrisma.project.update.mockResolvedValue({
        ...project,
        status: ProjectStatus.ARCHIVED,
      });

      const result = await service.archiveProject(OWNER, PROJECT);

      expect(result.data.status).toBe(ProjectStatus.ARCHIVED);
    });
  });

  describe('updateProject', () => {
    it('allows any member to edit the shared roadmap', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);
      mockPrisma.project.update.mockResolvedValue({ ...project, title: 'New' });

      const result = await service.updateProject(MEMBER, PROJECT, { title: 'New' });

      expect(result.data.title).toBe('New');
      expect(mockAccess.assertMember).toHaveBeenCalledWith(MEMBER, PROJECT);
    });

    it('does not use the owner-only check', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);
      mockPrisma.project.update.mockResolvedValue(project);

      await service.updateProject(MEMBER, PROJECT, { title: 'New' });

      expect(mockAccess.assertOwner).not.toHaveBeenCalled();
    });
  });

  describe('activateProject', () => {
    it('allows any member to activate', async () => {
      mockAccess.assertMember.mockResolvedValue({ role: 'MEMBER' });
      mockPrisma.project.findUnique.mockResolvedValue(project);
      mockPrisma.project.update.mockResolvedValue({
        ...project,
        status: ProjectStatus.ACTIVE,
      });

      const result = await service.activateProject(MEMBER, PROJECT);

      expect(result.data.status).toBe(ProjectStatus.ACTIVE);
      expect(mockAccess.assertMember).toHaveBeenCalledWith(MEMBER, PROJECT);
    });
  });

  describe('getProjectStats', () => {
    it('aggregates across every project the user belongs to', async () => {
      mockAccess.memberProjectIds.mockResolvedValue(['p1', 'p2']);
      mockPrisma.project.groupBy.mockResolvedValue([
        { status: ProjectStatus.ACTIVE, _count: { id: 2 } },
      ]);

      const result = await service.getProjectStats(MEMBER);

      expect(result.data.activeCount).toBe(2);
      expect(mockPrisma.project.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['p1', 'p2'] } } }),
      );
    });
  });
});
