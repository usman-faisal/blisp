import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@repo/db';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { UpdateTaskStatusResponse } from '@repo/types';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@ApiTags('tasks')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
