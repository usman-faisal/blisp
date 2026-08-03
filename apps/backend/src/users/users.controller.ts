import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from "@repo/db";
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto, LookupUserDto } from './dto/lookup-user.dto';
import { MinimalUserSelect } from './queries';

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

  /**
   * The people an invite picker can offer. Excludes the caller, and optionally
   * anyone already on a given project.
   */
  @ApiOperation({ summary: 'List users to invite' })
  @Get()
  async listUsers(
    @CurrentUser() user: MinimalUserSelect,
    @Query() query: ListUsersDto,
  ) {
    return this.userService.listUsers(user, query);
  }

  /**
   * Exact-match lookup, for inviting someone whose address is known but who is
   * not on the current page of the list.
   */
  @ApiOperation({ summary: 'Find one user by exact email' })
  @Get('lookup')
  async lookupUser(
    @CurrentUser() user: MinimalUserSelect,
    @Query() query: LookupUserDto,
  ) {
    return this.userService.lookupUserByEmail(user, query.email);
  }

  @ApiProperty({ title: 'Update Current User Profile', type: UpdateUserDto })
  @Patch('me')
  async updateCurrentUser(@CurrentUser() user: User, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateCurrentUser(user, updateUserDto);
  }
}
