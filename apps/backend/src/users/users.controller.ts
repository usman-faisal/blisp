import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from "@repo/db";
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
@ApiTags('User')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @ApiProperty({ title: 'Get Current User' })
  @Get('me')
  async getCurrentUser(@CurrentUser() user: User) {
    return this.userService.getCurrentUser(user);
  }

  @ApiProperty({ title: 'Update Current User Profile', type: UpdateUserDto })
  @Patch('me')
  async updateCurrentUser(@CurrentUser() user: User, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateCurrentUser(user, updateUserDto);
  }
}
