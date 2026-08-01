import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { GetTaskDetailResponse, UpdateTaskStatusResponse } from '@repo/types';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { AssignTaskResponse } from '@repo/types';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskStatus } from '@repo/db';
import {
  COLLABORATION_EVENTS,
  TaskAssignedEvent,
  TaskCompletedEvent,
} from 'src/notifications/events/collaboration.events';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
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
        assigneeId: task.assigneeId,
        assigneeName: task.assigneeName,
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

    // Only completion is worth interrupting teammates for. TODO and
    // IN_PROGRESS churn would make the notification list useless.
    if (dto.status === TaskStatus.DONE) {
      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      this.events.emit(
        COLLABORATION_EVENTS.TASK_COMPLETED,
        new TaskCompletedEvent(
          updated.id,
          updated.title,
          updated.project.id,
          updated.project.title,
          userId,
          actor?.name ?? 'A collaborator',
        ),
      );
    }

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

  /**
   * Assigns a task to a project member, or unassigns it when assigneeId is null.
   *
   * Any member can reassign any task — at 2-3 people, restricting this to the
   * current assignee creates friction without preventing anything.
   */
  async assignTask(
    userId: string,
    taskId: string,
    dto: AssignTaskDto,
  ): Promise<AssignTaskResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { title: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.access.assertMember(userId, task.projectId);

    const assigneeId = dto.assigneeId ?? null;
    let assigneeName: string | null = null;

    if (assigneeId) {
      // The assignee must belong to this project. Without this check a task
      // could be assigned to any user id, including someone with no access to
      // the project it belongs to.
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: task.projectId, userId: assigneeId } },
        include: { user: { select: { name: true } } },
      });

      if (!membership) {
        throw new BadRequestException(
          'That user is not a member of this project. Invite them first.',
        );
      }

      assigneeName = membership.user.name;
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId, assigneeName },
      select: { id: true, title: true, assigneeId: true, assigneeName: true },
    });

    this.logger.log(
      assigneeId
        ? `Task "${updated.title}" (${taskId}) assigned to ${assigneeName}.`
        : `Task "${updated.title}" (${taskId}) unassigned.`,
    );

    // The listener ignores unassignment and self-assignment; emitting either
    // way keeps the branching in one place.
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    this.events.emit(
      COLLABORATION_EVENTS.TASK_ASSIGNED,
      new TaskAssignedEvent(
        updated.id,
        updated.title,
        task.project.title,
        assigneeId,
        userId,
        actor?.name ?? 'A collaborator',
      ),
    );

    return {
      data: {
        taskId: updated.id,
        taskTitle: updated.title,
        assigneeId: updated.assigneeId,
        assigneeName: updated.assigneeName,
      },
      message: assigneeId ? 'Task assigned successfully.' : 'Task unassigned successfully.',
      success: true,
    };
  }
}
