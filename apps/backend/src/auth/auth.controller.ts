import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { User } from '@repo/db';
import { GetProfileResponse } from '@repo/types';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('auth')
export class AuthController {
  @Get('me')
  async getProfile(@CurrentUser() user: User): Promise<GetProfileResponse> {
    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: 'Profile retrieved successfully.',
      success: true,
    };
  }
}
