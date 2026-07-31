import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { GetTaskDetailResponse, UpdateTaskStatusResponse } from '@repo/types';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ProjectAccessService } from 'src/projects/project-access.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async getTaskById(userId: string, taskId: string): Promise<GetTaskDetailResponse> {
    // Resolve the task first, then authorise against its parent project. The
    // task id alone does not reveal anything until membership is confirmed.
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            techStack: true,
            status: true,
            classification: true,
          },
        },
        resources: {
          select: {
            id: true,
            title: true,
            summary: true,
            url: true,
            type: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.access.assertMember(userId, task.projectId);

    return {
      data: {
        id: task.id,
        title: task.title,
        status: task.status,
        project: task.project,
        resources: task.resources,
      },
      message: 'Task retrieved successfully.',
      success: true,
    };
  }

  async updateTaskStatus(
    userId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<UpdateTaskStatusResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, title: true, techStack: true } } },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    // Any member may move a task on a shared project. Restricting status
    // changes to the assignee would add friction with no benefit at 2-3 users.
    await this.access.assertMember(userId, task.projectId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
      include: { project: { select: { id: true, title: true, techStack: true } } },
    });

    this.logger.log(`Task "${updated.title}" (${taskId}) updated to ${dto.status} for user ${userId}.`);

    return {
      data: {
        taskId: updated.id,
        taskTitle: updated.title,
        projectTitle: updated.project.title,
        newStatus: updated.status,
      },
      message: 'Task status updated successfully.',
      success: true,
    };
  }
}
