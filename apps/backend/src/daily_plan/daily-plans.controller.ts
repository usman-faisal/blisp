import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { GetTodayPlanResponse, PullNextTaskResponse } from '@repo/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { DailyPlansService } from './daily-plans.service';

@ApiTags('daily-plans')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('daily-plans')
export class DailyPlansController {
  constructor(private readonly dailyPlansService: DailyPlansService) {}

  @Post('today/pull-next')
  @ApiOperation({
    summary: 'Pull the next backlog task into today\'s plan',
    description:
      'Finds the highest-priority unplanned TODO task from the user\'s active projects and assigns it to today\'s daily plan.',
  })
  @ApiResponse({ status: 201, description: 'Task pulled into today\'s plan.' })
  @ApiResponse({ status: 404, description: 'No daily plan exists for today.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async pullNextTask(@CurrentUser() user: User): Promise<PullNextTaskResponse> {
    return this.dailyPlansService.pullNextTask(user.id);
  }

  @Get('today')
  @ApiOperation({
    summary: 'Get today\'s daily plan',
    description: 'Retrieves the daily plan and planned tasks for the current user for today.',
  })
  @ApiResponse({ status: 200, description: 'Today\'s daily plan retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getTodayPlan(@CurrentUser() user: User): Promise<GetTodayPlanResponse> {
    return this.dailyPlansService.getTodayPlan(user.id);
  }
}
