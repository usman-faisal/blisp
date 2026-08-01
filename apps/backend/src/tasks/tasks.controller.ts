import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { AssignTaskResponse, GetTaskDetailResponse, UpdateTaskStatusResponse } from '@repo/types';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';

@ApiTags('tasks')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get task details',
    description: 'Returns a task with its resources and parent project info.',
  })
  @ApiParam({ name: 'id', description: 'Task UUID', type: String })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Task not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getTaskById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GetTaskDetailResponse> {
    return this.tasksService.getTaskById(user.id, id);
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Assign or unassign a task',
    description:
      'Assigns the task to a project member. Pass assigneeId: null to unassign. Any member may reassign.',
  })
  @ApiParam({ name: 'id', description: 'Task UUID', type: String })
  @ApiResponse({ status: 200, description: 'Task assignment updated.' })
  @ApiResponse({ status: 400, description: 'Assignee is not a member of the project.' })
  @ApiResponse({ status: 404, description: 'Task not found or you are not a member.' })
  async assignTask(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTaskDto,
  ): Promise<AssignTaskResponse> {
    return this.tasksService.assignTask(user.id, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update task status',
    description: 'Updates the status of a task (TODO, IN_PROGRESS, DONE). Queues resource research when moved to IN_PROGRESS.',
  })
  @ApiParam({ name: 'id', description: 'Task UUID', type: String })
  @ApiResponse({ status: 200, description: 'Task status updated successfully.' })
  @ApiResponse({ status: 404, description: 'Task not found or not owned by the user.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateTaskStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<UpdateTaskStatusResponse> {
    return this.tasksService.updateTaskStatus(user.id, id, dto);
  }
}
