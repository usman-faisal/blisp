import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/common/services/prisma.service';
import { UsersService } from '../users.service';

/**
 * Slice 8B: finding someone to invite.
 *
 * Two routes with deliberately different threat models. `lookup` is exact-match
 * so it cannot be walked one character at a time; `list` is the browsable one
 * and is therefore paginated, capped, and limited to non-internal fields.
 * Several tests assert on the Prisma `where`/`select` rather than the output,
 * because a widened match or a leaked column still returns a valid-looking
 * response.
 */
describe('UsersService — invite recipient lookup', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const ALICE = { id: 'user_alice', name: 'Alice', email: 'alice@example.com' };
  const BOB = { id: 'user_bob', name: 'Bob', email: 'bob@example.com' };
  const PROJECT = 'a3f1e1a0-0000-4000-8000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('lookupUserByEmail', () => {
    it('returns the matching user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      const result = await service.lookupUserByEmail(ALICE, BOB.email);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(BOB);
    });

    // The whole point of this route. `contains` would make it a directory
    // reachable one character at a time — a different feature entirely.
    it('matches on equals, never contains', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      await service.lookupUserByEmail(ALICE, BOB.email);

      const where = mockPrisma.user.findFirst.mock.calls[0][0].where;
      expect(where.email).toEqual({ equals: BOB.email, mode: 'insensitive' });
      expect(JSON.stringify(where)).not.toContain('contains');
    });

    it('matches case-insensitively', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      await service.lookupUserByEmail(ALICE, 'BOB@EXAMPLE.COM');

      expect(mockPrisma.user.findFirst.mock.calls[0][0].where.email.mode).toBe(
        'insensitive',
      );
    });

    it('excludes the caller', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      await service.lookupUserByEmail(ALICE, BOB.email);

      expect(mockPrisma.user.findFirst.mock.calls[0][0].where.id).toEqual({
        not: ALICE.id,
      });
    });

    // The observable half of the exclusion above: you cannot invite yourself.
    it('reports not found for your own address', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.lookupUserByEmail(ALICE, ALICE.email)).rejects.toThrow(
        /no account found/i,
      );
    });

    it('reports not found for an unregistered address', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.lookupUserByEmail(ALICE, 'nobody@example.com'),
      ).rejects.toThrow(/no account found/i);
    });

    // hasNotifications and createdAt are internal; leaking them into another
    // user's client is a privacy bug, not a cosmetic one.
    it('selects only id, name and email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      await service.lookupUserByEmail(ALICE, BOB.email);

      expect(mockPrisma.user.findFirst.mock.calls[0][0].select).toEqual({
        id: true,
        email: true,
        name: true,
      });
    });

    // findFirst, not findMany: email is unique, and one result is the contract.
    it('asks for a single record', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(BOB);

      await service.lookupUserByEmail(ALICE, BOB.email);

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    beforeEach(() => {
      mockPrisma.user.findMany.mockResolvedValue([BOB]);
      mockPrisma.user.count.mockResolvedValue(1);
    });

    it('returns users with pagination', async () => {
      const result = await service.listUsers(ALICE, {});

      expect(result.data.users).toEqual([BOB]);
      expect(result.data.pagination).toEqual({
        totalCount: 1,
        totalPages: 1,
        page: 1,
        limit: 20,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('never includes the caller', async () => {
      await service.listUsers(ALICE, {});

      expect(mockPrisma.user.findMany.mock.calls[0][0].where.id).toEqual({
        not: ALICE.id,
      });
    });

    it('returns only id, name and email', async () => {
      await service.listUsers(ALICE, {});

      expect(mockPrisma.user.findMany.mock.calls[0][0].select).toEqual({
        id: true,
        email: true,
        name: true,
      });
    });

    // The older getAllUsers searched email only, despite an index on name. In a
    // picker, typing a colleague's name and getting nothing reads as "they have
    // no account".
    it('searches name as well as email', async () => {
      await service.listUsers(ALICE, { search: 'bo' });

      const or = mockPrisma.user.findMany.mock.calls[0][0].where.OR;
      expect(or).toEqual([
        { name: { contains: 'bo', mode: 'insensitive' } },
        { email: { contains: 'bo', mode: 'insensitive' } },
      ]);
    });

    it('omits the search clause entirely when no term is given', async () => {
      await service.listUsers(ALICE, {});

      expect(mockPrisma.user.findMany.mock.calls[0][0].where.OR).toBeUndefined();
    });

    // Offering someone the invite would only 409 on is a dead end in the UI.
    it('hides existing members when excludeProjectId is given', async () => {
      await service.listUsers(ALICE, { excludeProjectId: PROJECT });

      expect(
        mockPrisma.user.findMany.mock.calls[0][0].where.projectMembers,
      ).toEqual({ none: { projectId: PROJECT } });
    });

    it('does not filter by project when none is given', async () => {
      await service.listUsers(ALICE, {});

      expect(
        mockPrisma.user.findMany.mock.calls[0][0].where.projectMembers,
      ).toBeUndefined();
    });

    it('applies the same filters to the count as to the page', async () => {
      await service.listUsers(ALICE, { search: 'bo', excludeProjectId: PROJECT });

      expect(mockPrisma.user.count.mock.calls[0][0].where).toEqual(
        mockPrisma.user.findMany.mock.calls[0][0].where,
      );
    });

    it('paginates', async () => {
      mockPrisma.user.count.mockResolvedValue(45);

      const result = await service.listUsers(ALICE, { page: 2, limit: 20 });

      expect(mockPrisma.user.findMany.mock.calls[0][0]).toMatchObject({
        skip: 20,
        take: 20,
      });
      expect(result.data.pagination).toMatchObject({
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it('orders by name so the picker is stable', async () => {
      await service.listUsers(ALICE, {});

      expect(mockPrisma.user.findMany.mock.calls[0][0].orderBy).toEqual({
        name: 'asc',
      });
    });
  });
});
