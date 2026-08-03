import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ApiResponse, QueryParams } from 'src/common/types/type';
import { throwError } from 'src/common/utils/helpers';
import {  User, Prisma, InviteStatus } from "@repo/db";
import {
  minimalUserSelect,
  MinimalUserSelect,
  UserSelect,
  userSelect,
} from './queries';
import { GetAllUserResponse, ListUsersResponse } from './types';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/lookup-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  async getAllUsers(user: User, query?: QueryParams): Promise<ApiResponse<GetAllUserResponse>> {
    try {
      const { page = 1, limit = 20, search = '', filter = '', sort = '' } = query || {};
      const where: Prisma.UserWhereInput = {
        id: { not: user.id },
      };
      const orderBy: Prisma.UserOrderByWithRelationInput = {};

      if (search) {
        where.OR = [{ email: { contains: search, mode: 'insensitive' } }];
      }

      if (filter) orderBy[filter] = 'asc';
      if (sort) orderBy[sort] = 'desc';

      const [users, totalCount] = await Promise.all([
        this.prismaService.user.findMany({
          select: userSelect,
          where,
          orderBy,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        this.prismaService.user.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / Number(limit));

      return {
        message: 'Users retrieved successfully',
        success: true,
        data: {
          users,
          pagination: {
            totalCount,
            totalPages,
            page: Number(page),
            limit: Number(limit),
            hasNextPage: Number(page) < totalPages,
            hasPrevPage: Number(page) > 1,
          },
        },
      };
    } catch (err: any) {
      throw throwError(err.message || 'Failed to retrieve users', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Exact-match lookup for inviting someone whose address you already know.
   *
   * `equals`, never `contains`: a substring match would turn this into a
   * browsable directory reachable one character at a time, which is a different
   * feature with a different threat model. listUsers below is the browsable one,
   * and it is paginated and capped for that reason.
   */
  async lookupUserByEmail(
    requester: MinimalUserSelect,
    email: string,
  ): Promise<ApiResponse<MinimalUserSelect>> {
    try {
      const found = await this.prismaService.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          // You cannot invite yourself.
          id: { not: requester.id },
        },
        select: minimalUserSelect,
      });

      if (!found) {
        throw throwError(
          'No account found with that email address.',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        message: 'User found',
        success: true,
        data: found,
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to look up user',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * The people an invite picker can offer.
   *
   * Returns minimalUserSelect rather than userSelect: `hasNotifications` and
   * `createdAt` are internal and have no business in someone else's client.
   *
   * Search covers name *and* email. The older getAllUsers matched email only,
   * despite an index on name — in a picker, typing a colleague's name and
   * getting nothing reads as "they have no account".
   */
  async listUsers(
    requester: MinimalUserSelect,
    query: ListUsersDto,
  ): Promise<ApiResponse<ListUsersResponse>> {
    try {
      const { search, page = 1, limit = 20, excludeProjectId } = query;

      const where: Prisma.UserWhereInput = {
        id: { not: requester.id },
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Hiding existing members keeps the picker from offering someone the
      // invite would only reject with a 409. People who already have a live
      // invite are hidden for the same reason — the send would 409 on them too.
      if (excludeProjectId) {
        where.projectMembers = { none: { projectId: excludeProjectId } };
        where.invitesReceived = {
          none: {
            projectId: excludeProjectId,
            status: InviteStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
        };
      }

      const [users, totalCount] = await Promise.all([
        this.prismaService.user.findMany({
          where,
          select: minimalUserSelect,
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prismaService.user.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        message: 'Users retrieved successfully',
        success: true,
        data: {
          users,
          pagination: {
            totalCount,
            totalPages,
            page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      };
    } catch (err: any) {
      throw throwError(
        err.message || 'Failed to retrieve users',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id },
      });

      if (!user) throw throwError('User not found', HttpStatus.NOT_FOUND);

      return {
        message: 'User retrieved successfully',
        success: true,
        data: user,
      }
    } catch (err: any) {
      throw throwError(err.message || 'Failed to retrieve user', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getCurrentUser(user: User): Promise<ApiResponse<UserSelect>> {
    try {
      const currentUser = await this.prismaService.user.findUnique({
        where: { id: user.id },
        select: userSelect,
      });

      if (!currentUser) throw throwError('User not found', HttpStatus.NOT_FOUND);

      return {
        message: 'User retrieved successfully',
        success: true,
        data: currentUser,
      };
    } catch (err: any) {
      throw throwError(err.message || 'Failed to retrieve user', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateCurrentUser(user: User, dto: UpdateUserDto): Promise<ApiResponse<UserSelect>> {
    try {
      const updatedUser = await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          name: dto.name,
        },
        select: userSelect,
      });

      if (!updatedUser) throw throwError('User not found', HttpStatus.NOT_FOUND);

      return {
        message: 'User profile updated successfully',
        success: true,
        data: updatedUser,
      };
    } catch (err: any) {
      throw throwError(err.message || 'Failed to update user profile', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
