import { Controller, UseGuards, Patch, Get, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiParam, ApiProperty, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { QueryParams } from 'src/common/types/type';
import { MinimalUserSelect } from 'src/users/queries';

@Controller('notification')
@UseGuards(AuthGuard)
@ApiTags('Notification')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationsService) {}

  @ApiProperty({ title: 'Get All Notifications' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @Get()
  async getAllNotifications(@CurrentUser() user: MinimalUserSelect, @Query() query: QueryParams) {
    return this.notificationService.getAllNotifications(user, query);
  }

  @ApiProperty({ title: 'Clear All Notifications' })
  @Delete('clear-all')
  async clearAllNotifications(@CurrentUser() user: MinimalUserSelect) {
    return this.notificationService.clearAllNotifications(user);
  }
}
