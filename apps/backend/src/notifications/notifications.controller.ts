import { Controller, UseGuards, Patch, Get, Delete, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiParam, ApiProperty, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { NotificationsService, NotificationQueryParams } from './notifications.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MinimalUserSelect } from 'src/users/queries';

@Controller('notification')
@UseGuards(AuthGuard)
@ApiTags('Notification')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationsService) {}

  @ApiProperty({ title: 'Get All Notifications' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'unreadOnly', type: Boolean, required: false })
  @Get()
  async getAllNotifications(
    @CurrentUser() user: MinimalUserSelect,
    @Query() query: NotificationQueryParams,
  ) {
    return this.notificationService.getAllNotifications(user, query);
  }

  // Declared before the parameterised routes below so `read-all` is matched as a
  // literal rather than captured as an `:id`.
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: MinimalUserSelect) {
    return this.notificationService.markAllAsRead(user);
  }

  @ApiProperty({ title: 'Clear All Notifications' })
  @Delete('clear-all')
  async clearAllNotifications(@CurrentUser() user: MinimalUserSelect) {
    return this.notificationService.clearAllNotifications(user);
  }

  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', description: 'Notification id' })
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: MinimalUserSelect,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markAsRead(user, id);
  }

  @ApiOperation({ summary: 'Dismiss a single notification' })
  @ApiParam({ name: 'id', description: 'Notification id' })
  @Delete(':id')
  async dismissNotification(
    @CurrentUser() user: MinimalUserSelect,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.dismissNotification(user, id);
  }
}
