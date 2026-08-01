import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectRole, TaskComment } from '@repo/db';
import {
  CreateTaskCommentResponse,
  DeleteTaskCommentResponse,
  GetTaskCommentsResponse,
  TaskCommentResponse,
  UpdateTaskCommentResponse,
} from '@repo/types';
import { PrismaService } from 'src/common/services/prisma.service';
import {
  COLLABORATION_EVENTS,
  TaskCommentedEvent,
} from 'src/notifications/events/collaboration.events';
import { ProjectAccessService } from 'src/projects/project-access.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { extractMentionedUserIds, toExcerpt } from './mentions.util';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: EventEmitter2,
  ) {}

  /** Resolves the task and authorises the caller against its project. */
  private async loadTaskForMember(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { title: true, userId: true } },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.access.assertMember(userId, task.projectId);

    return task;
  }

  private async projectMemberNames(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    });

    return members.map((member) => ({ userId: member.userId, name: member.user.name }));
  }

  private toResponse(
    comment: TaskComment,
    requesterId: string,
    mentionedUserIds: string[],
  ): TaskCommentResponse {
    return {
      id: comment.id,
      body: comment.body,
      authorId: comment.authorId,
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      isOwn: comment.authorId === requesterId,
      mentionedUserIds,
    };
  }

  async getComments(userId: string, taskId: string): Promise<GetTaskCommentsResponse> {
    const task = await this.loadTaskForMember(userId, taskId);

    const [comments, members] = await Promise.all([
      this.prisma.taskComment.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
      }),
      this.projectMemberNames(task.projectId),
    ]);

    return {
      data: comments.map((comment) =>
        this.toResponse(comment, userId, extractMentionedUserIds(comment.body, members)),
      ),
      message: 'Comments retrieved successfully.',
      success: true,
    };
  }

  async createComment(
    userId: string,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<CreateTaskCommentResponse> {
    const task = await this.loadTaskForMember(userId, taskId);
    const members = await this.projectMemberNames(task.projectId);

    const author = members.find((member) => member.userId === userId);
    const mentionedUserIds = extractMentionedUserIds(dto.body, members);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: userId,
        // Snapshot the byline, so it stays what it was when written.
        authorName: author?.name ?? 'A collaborator',
        body: dto.body,
      },
    });

    this.logger.log(
      `Comment ${comment.id} added to task ${taskId} by ${comment.authorName}` +
        (mentionedUserIds.length ? ` (mentions ${mentionedUserIds.length}).` : '.'),
    );

    // After the write, so a notification failure cannot lose the comment.
    this.events.emit(
      COLLABORATION_EVENTS.TASK_COMMENTED,
      new TaskCommentedEvent(
        task.id,
        task.title,
        task.projectId,
        task.project.title,
        userId,
        comment.authorName,
        task.project.userId,
        mentionedUserIds,
        toExcerpt(dto.body),
      ),
    );

    return {
      data: this.toResponse(comment, userId, mentionedUserIds),
      message: 'Comment added successfully.',
      success: true,
    };
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ): Promise<UpdateTaskCommentResponse> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: { select: { projectId: true } } },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    await this.access.assertMember(userId, comment.task.projectId);

    // Editing someone else's words is never acceptable, even for the owner.
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments.');
    }

    const updated = await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { body: dto.body },
    });

    const members = await this.projectMemberNames(comment.task.projectId);

    // No event on edit: re-notifying everyone whenever a typo is fixed would
    // make mentions a nuisance.
    return {
      data: this.toResponse(updated, userId, extractMentionedUserIds(updated.body, members)),
      message: 'Comment updated successfully.',
      success: true,
    };
  }

  async deleteComment(userId: string, commentId: string): Promise<DeleteTaskCommentResponse> {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
      include: { task: { select: { projectId: true } } },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    const membership = await this.access.assertMember(userId, comment.task.projectId);

    // The author can always remove their own comment; the owner can moderate.
    const canDelete = comment.authorId === userId || membership.role === ProjectRole.OWNER;

    if (!canDelete) {
      throw new ForbiddenException(
        'You can only delete your own comments, unless you own the project.',
      );
    }

    await this.prisma.taskComment.delete({ where: { id: commentId } });

    this.logger.log(`Comment ${commentId} deleted by ${userId}.`);

    return {
      data: { id: commentId },
      message: 'Comment deleted successfully.',
      success: true,
    };
  }
}
