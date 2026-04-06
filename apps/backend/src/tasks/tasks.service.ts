import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { JOBS, QUEUES } from 'src/common/lib/constants';
import { GetTaskDetailResponse, UpdateTaskStatusResponse } from '@repo/types';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.INCUBATOR) private readonly incubatorQueue: Queue,
  ) {}

  async getTaskById(userId: string, taskId: string): Promise<GetTaskDetailResponse> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { userId } },
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
      throw new NotFoundException('Task not found or you do not own it.');
    }

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
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { userId } },
      include: { project: { select: { id: true, title: true, techStack: true } } },
    });

    if (!task) {
      throw new NotFoundException('Task not found or you do not own it.');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
      include: { project: { select: { id: true, title: true, techStack: true } } },
    });

    if (dto.status === TaskStatus.IN_PROGRESS) {
      const existingCount = await this.prisma.resource.count({
        where: { taskId: updated.id },
      });
      if (existingCount === 0) {
        await this.incubatorQueue.add(JOBS.TASK_RESEARCH, {
          taskId: updated.id,
          projectId: updated.project.id,
          taskTitle: updated.title,
          projectTitle: updated.project.title,
          techStack: updated.project.techStack,
        });
        this.logger.log(`Queued TASK_RESEARCH for task ${updated.id} on IN_PROGRESS transition`);
      }
    }

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
