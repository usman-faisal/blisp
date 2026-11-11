import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { DeferTasksDto } from './dto/defer-tasks.dto';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { SetMilestoneStatusDto } from './dto/set-milestone-status.dto';
import { UpdateRoadmapSettingsDto } from './dto/update-roadmap-settings.dto';
import { RoadmapService } from './roadmap.service';

/**
 * Roadmap and tracker, addressed under the project that authorises access.
 * Every handler goes through ProjectAccessService.assertMember.
 */
@ApiTags('roadmap')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('projects/:projectId/roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the roadmap',
    description:
      'Milestones with their tasks, effort-weighted progress at milestone and project level, and ' +
      'the schedule assessment including options when the work does not fit the deadline.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Roadmap retrieved.' })
  @ApiResponse({ status: 404, description: 'Project not found or not a member.' })
  async getRoadmap(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.roadmapService.getRoadmap(user.id, projectId);

    return { data, message: 'Roadmap retrieved.', success: true };
  }

  @Get('suggested-scope')
  @ApiOperation({
    summary: 'Scope suggested from the approved discovery report',
    description:
      'Only an APPROVED report is used, and every item is editable before planning. Returns an ' +
      'empty list when there is no approved report — the user can still enter scope themselves.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Suggested scope retrieved.' })
  async getSuggestedScope(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.roadmapService.suggestScope(user.id, projectId);

    return { data, message: 'Suggested scope retrieved.', success: true };
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Build the roadmap from confirmed scope',
    description:
      'Replaces the milestone structure. Existing tasks are unlinked rather than deleted, so ' +
      'completed work is preserved.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Roadmap generated.' })
  @ApiResponse({ status: 400, description: 'No scope given.' })
  async generate(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateRoadmapDto,
  ) {
    const data = await this.roadmapService.generateRoadmap(
      user.id,
      projectId,
      dto.scope.map((item) => ({ ...item, fromReport: item.fromReport ?? false })),
    );

    return { data, message: `Roadmap built with ${data.milestones.length} milestone(s).`, success: true };
  }

  @Get('today')
  @ApiOperation({
    summary: "Today's planned tasks and completion",
    description: 'daily is null when nothing is planned for today — a rest day is not 0% complete.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: "Today's tasks retrieved." })
  async getToday(@CurrentUser() user: User, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const data = await this.roadmapService.getToday(user.id, projectId);

    return { data, message: "Today's plan retrieved.", success: true };
  }

  @Get('history')
  @ApiOperation({ summary: 'Completion history, one entry per day including empty days' })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'History retrieved.' })
  async getHistory(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('days') days?: string,
  ) {
    // Clamped: an unbounded window would scan the whole table.
    const parsed = Number(days);
    const window = Number.isInteger(parsed) && parsed >= 1 && parsed <= 90 ? parsed : 7;
    const data = await this.roadmapService.getWeeklyHistory(user.id, projectId, window);

    return { data, message: 'History retrieved.', success: true };
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Set deadline, hours per day, working days and skill level',
    description: 'Changing availability re-assesses fit without regenerating tasks or touching completed work.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 200, description: 'Settings saved.' })
  @ApiResponse({ status: 400, description: 'Invalid settings.' })
  async updateSettings(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateRoadmapSettingsDto,
  ) {
    const data = await this.roadmapService.updateSettings(user.id, projectId, dto);

    return { data, message: 'Roadmap settings saved.', success: true };
  }

  @Post('defer')
  @ApiOperation({
    summary: 'Defer tasks to shrink scope',
    description:
      'Takes the exact task ids the user confirmed in the preview, so what they saw is what is ' +
      'applied. Refuses to defer completed work.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiResponse({ status: 201, description: 'Tasks deferred.' })
  @ApiResponse({ status: 400, description: 'Stale preview, or completed work included.' })
  async defer(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: DeferTasksDto,
  ) {
    const data = await this.roadmapService.deferTasks(user.id, projectId, dto.taskIds);

    return { data, message: `Deferred ${data.deferred} task(s).`, success: true };
  }

  @Post('tasks/:taskId/restore')
  @ApiOperation({ summary: 'Bring a deferred or cancelled task back into scope' })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'taskId', description: 'Task UUID', type: String })
  @ApiResponse({ status: 201, description: 'Task restored to TODO.' })
  @ApiResponse({ status: 400, description: 'That task is already in scope.' })
  async restore(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const data = await this.roadmapService.restoreTask(user.id, projectId, taskId);

    return { data, message: 'Task restored.', success: true };
  }

  @Patch('milestones/:milestoneId')
  @ApiOperation({ summary: 'Set a milestone status' })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiParam({ name: 'milestoneId', description: 'Milestone UUID', type: String })
  @ApiResponse({ status: 200, description: 'Milestone updated.' })
  async setMilestoneStatus(
    @CurrentUser() user: User,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: SetMilestoneStatusDto,
  ) {
    const data = await this.roadmapService.setMilestoneStatus(user.id, projectId, milestoneId, dto.status);

    return { data, message: 'Milestone updated.', success: true };
  }
}
