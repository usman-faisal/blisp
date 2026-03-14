import { Controller, UseGuards, Patch, Get, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiParam, ApiProperty, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { NotificationService } from './notification.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { QueryParams } from 'src/common/types/type';
import { MinimalUserSelect } from 'src/user/queries';

@Controller('notification')
@UseGuards(AuthGuard)
@ApiTags('Notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
