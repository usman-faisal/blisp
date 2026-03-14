import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { ApiResponse, QueryParams } from 'src/common/types/type';
import { throwError } from 'src/common/utils/helpers';
import {  User, Prisma } from "@repo/db";
import { UserSelect, userSelect } from './queries';
import { GetAllUserResponse } from './types';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
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
