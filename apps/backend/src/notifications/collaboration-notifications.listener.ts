import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@repo/db';
import { PrismaService } from 'src/common/services/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  COLLABORATION_EVENTS,
  InviteDeclinedEvent,
  InviteReceivedEvent,
  MemberJoinedEvent,
  TaskAssignedEvent,
  TaskCommentedEvent,
  TaskCompletedEvent,
} from './events/collaboration.events';

/**
 * Turns collaboration events into notifications.
 *
 * Runs outside the emitting request's transaction on purpose: a notification
 * insert failing must not roll back the join, assignment or status change that
 * caused it. Every handler therefore swallows its own errors after logging.
 */
@Injectable()
export class CollaborationNotificationsListener {
  private readonly logger = new Logger(CollaborationNotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Delegates to NotificationsService, which owns the write and the badge flag.
   * This used to be implemented here, but invites are a second producer and
   * cannot reach a private method on a listener.
   */
  private async notify(
    userIds: string[],
    payload: {
      title: string;
      message: string;
      url?: string;
      type: NotificationType;
      inviteId?: string;
    },
  ): Promise<void> {
    await this.notifications.notify(userIds, payload);
  }

  /** Everyone already on the project, minus the person who acted. */
  private async otherMemberIds(projectId: string, excludeUserId: string): Promise<string[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { not: excludeUserId } },
      select: { userId: true },
    });

    return members.map((member) => member.userId);
  }

  @OnEvent(COLLABORATION_EVENTS.MEMBER_JOINED)
  async onMemberJoined(event: MemberJoinedEvent): Promise<void> {
    try {
      const recipients = await this.otherMemberIds(event.projectId, event.joinerId);

      await this.notify(recipients, {
        title: 'New collaborator',
        message: `${event.joinerName} joined "${event.projectTitle}".`,
        url: `/project/${event.projectId}`,
        type: NotificationType.MEMBER_JOINED,
      });
    } catch (error) {
      this.logger.error(`Failed to notify members of a join on ${event.projectId}.`, error);
    }
  }

  /**
   * The one actionable notification in the system: it carries `inviteId`, so the
   * client can render accept and decline on the row itself rather than sending
   * the user off to find the invite.
   *
   * No `url`. Every other notification navigates somewhere; this one is answered
   * in place. Pointing it at the project would be worse than useless — the
   * recipient is not a member yet, so the screen would 404.
   */
  @OnEvent(COLLABORATION_EVENTS.INVITE_RECEIVED)
  async onInviteReceived(event: InviteReceivedEvent): Promise<void> {
    try {
      await this.notify([event.invitedUserId], {
        title: 'Project invitation',
        message: `${event.inviterName} invited you to collaborate on "${event.projectTitle}".`,
        type: NotificationType.PROJECT_INVITE,
        inviteId: event.inviteId,
      });
    } catch (error) {
      this.logger.error(`Failed to notify ${event.invitedUserId} of invite ${event.inviteId}.`, error);
    }
  }

  /**
   * Only the sender hears about a decline, and only for a targeted invite —
   * they asked a specific person, so the silence would otherwise be ambiguous.
   */
  @OnEvent(COLLABORATION_EVENTS.INVITE_DECLINED)
  async onInviteDeclined(event: InviteDeclinedEvent): Promise<void> {
    try {
      await this.notify([event.inviterId], {
        title: 'Invitation declined',
        message: `${event.declinerName} declined your invitation to "${event.projectTitle}".`,
        url: `/project/${event.projectId}`,
        type: NotificationType.PROJECT_INVITE,
      });
    } catch (error) {
      this.logger.error(`Failed to notify ${event.inviterId} of a decline.`, error);
    }
  }

  @OnEvent(COLLABORATION_EVENTS.TASK_ASSIGNED)
  async onTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    // Unassignment notifies nobody, and self-assignment needs no announcement.
    if (!event.assigneeId || event.assigneeId === event.actorId) {
      return;
    }

    try {
      await this.notify([event.assigneeId], {
        title: 'Task assigned to you',
        message: `${event.actorName} assigned you "${event.taskTitle}" in ${event.projectTitle}.`,
        url: `/task/${event.taskId}`,
        type: NotificationType.TASK_ASSIGNED,
      });
    } catch (error) {
      this.logger.error(`Failed to notify assignee of task ${event.taskId}.`, error);
    }
  }

  /**
   * Two audiences, deliberately different messages:
   *
   *   - anyone @mentioned gets "X mentioned you"
   *   - the project owner gets "X commented" so they keep oversight
   *
   * A mentioned owner receives only the mention — being told twice about one
   * comment reads as a bug. The comment's author is never notified either way.
   */
  @OnEvent(COLLABORATION_EVENTS.TASK_COMMENTED)
  async onTaskCommented(event: TaskCommentedEvent): Promise<void> {
    try {
      const mentioned = event.mentionedUserIds.filter((id) => id !== event.actorId);

      if (mentioned.length > 0) {
        await this.notify(mentioned, {
          title: 'You were mentioned',
          message: `${event.actorName} mentioned you on "${event.taskTitle}": ${event.excerpt}`,
          url: `/task/${event.taskId}`,
          type: NotificationType.TASK_MENTIONED,
        });
      }

      const notifyOwner =
        event.projectOwnerId &&
        event.projectOwnerId !== event.actorId &&
        !mentioned.includes(event.projectOwnerId);

      if (notifyOwner) {
        await this.notify([event.projectOwnerId!], {
          title: 'New comment',
          message: `${event.actorName} commented on "${event.taskTitle}": ${event.excerpt}`,
          url: `/task/${event.taskId}`,
          type: NotificationType.TASK_COMMENTED,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify about a comment on ${event.taskId}.`, error);
    }
  }

  @OnEvent(COLLABORATION_EVENTS.TASK_COMPLETED)
  async onTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    try {
      const recipients = await this.otherMemberIds(event.projectId, event.actorId);

      // Solo projects would otherwise notify nobody at the cost of a query;
      // notify() already no-ops on an empty list.
      await this.notify(recipients, {
        title: 'Task completed',
        message: `${event.actorName} completed "${event.taskTitle}" in ${event.projectTitle}.`,
        url: `/project/${event.projectId}`,
        type: NotificationType.TASK_COMPLETED,
      });
    } catch (error) {
      this.logger.error(`Failed to notify members of completion on ${event.taskId}.`, error);
    }
  }
}
