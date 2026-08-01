/**
 * Collaboration events consumed by CollaborationNotificationsListener.
 *
 * Emitted rather than written inline so a notification failure can never fail
 * the action that triggered it — joining a project must not roll back because
 * a notification insert threw.
 */

export const COLLABORATION_EVENTS = {
  MEMBER_JOINED: 'collaboration.member.joined',
  TASK_ASSIGNED: 'collaboration.task.assigned',
  TASK_COMPLETED: 'collaboration.task.completed',
  TASK_COMMENTED: 'collaboration.task.commented',
} as const;

export class MemberJoinedEvent {
  constructor(
    readonly projectId: string,
    readonly projectTitle: string,
    /** Who joined — excluded from the recipients. */
    readonly joinerId: string,
    readonly joinerName: string,
  ) {}
}

export class TaskAssignedEvent {
  constructor(
    readonly taskId: string,
    readonly taskTitle: string,
    readonly projectTitle: string,
    /** Who was assigned. Null when the task was unassigned — no notification. */
    readonly assigneeId: string | null,
    /** Who performed the assignment; not notified about their own action. */
    readonly actorId: string,
    readonly actorName: string,
  ) {}
}

export class TaskCompletedEvent {
  constructor(
    readonly taskId: string,
    readonly taskTitle: string,
    readonly projectId: string,
    readonly projectTitle: string,
    /** Who completed it — excluded from the recipients. */
    readonly actorId: string,
    readonly actorName: string,
  ) {}
}

export class TaskCommentedEvent {
  constructor(
    readonly taskId: string,
    readonly taskTitle: string,
    readonly projectId: string,
    readonly projectTitle: string,
    /** Who wrote it — never notified about their own comment. */
    readonly actorId: string,
    readonly actorName: string,
    /** Project owner, so they hear about every comment. Null if they wrote it. */
    readonly projectOwnerId: string | null,
    /** Members named with @ in the body. Each is notified individually. */
    readonly mentionedUserIds: string[],
    readonly excerpt: string,
  ) {}
}
