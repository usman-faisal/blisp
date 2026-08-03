import type {
  Task,
  DailyPlan,
  Resource,
  Project,
  BrainDump,
  User,
  PipelineStage,
  ProjectEvent,
  ProjectMember,
  ProjectInvite,
  Notification,
  NotificationType,
  InviteStatus,
} from '@repo/db';

export interface ApiResponse<T = void> {
  data: T;
  message: string;
  success: boolean;
}

/**
 * Shape returned by every paged endpoint. Defined here rather than in the
 * backend so both sides share one definition; `common/types/type.ts` re-exports
 * it, which keeps the existing `src/common/types/type` imports working.
 */
export interface PaginationInfo {
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface TaskResponse {
  id: Task['id'];
  title: Task['title'];
  status: Task['status'];
}

export interface DailyPlanResponsePayload {
  id: DailyPlan['id'];
  summary: DailyPlan['summary'];
  tasks: TaskResponse[];
}

export type GetTodayPlanResponse = ApiResponse<DailyPlanResponsePayload | null>;

export interface ResourceResponse {
  id: Resource['id'];
  title: Resource['title'];
  summary: Resource['summary'];
  url: Resource['url'];
  type: Resource['type'];
}

export interface TaskCountsPayload {
  todo: number;
  inProgress: number;
  done: number;
  total: number;
}

export interface ProjectResponse {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  techStack: Project['techStack'];
  resources: ResourceResponse[];
  status: Project['status'];
  classification: Project['classification'];
  taskCounts?: TaskCountsPayload;
}

export type GetProjectsResponse = ApiResponse<ProjectResponse[]>;

export interface ProjectStatsResponsePayload {
  activeCount: number;
  incubatingCount: number;
  completedCount: number;
}

export type GetProjectStatsResponse = ApiResponse<ProjectStatsResponsePayload>;

export interface ActivateProjectResponsePayload {
  id: Project['id'];
  status: Project['status'];
}

export type ActivateProjectResponse = ApiResponse<ActivateProjectResponsePayload>;

export interface BrainDumpProjectPayload {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  classification: Project['classification'];
  status: Project['status'];
  techStack: Project['techStack'];
  tasks: TaskResponse[];
}

export interface BrainDumpResponsePayload {
  id: BrainDump['id'];
  rawTranscript: BrainDump['rawTranscript'];
  // processedAt comes across the network as an ISO string, while Prisma types it as Date | null.
  processedAt: string | null;
  projects: BrainDumpProjectPayload[];
}

export type BrainDumpResponse = ApiResponse<BrainDumpResponsePayload>;

export interface UserResponsePayload {
  id: User['id'];
  email: User['email'];
  name: User['name'];
}

export type GetProfileResponse = ApiResponse<UserResponsePayload>;

export interface PullNextTaskPayload {
  taskId: Task['id'];
  taskTitle: Task['title'];
  projectTitle: Project['title'];
  status: Task['status'];
  plannedFor: Date | string | null;
}

export type PullNextTaskResponse = ApiResponse<PullNextTaskPayload | null>;

export interface ProgressUpdateResponsePayload {
  taskId: Task['id'];
  taskTitle: Task['title'];
  projectTitle: Project['title'];
  newStatus: Task['status'];
}

export type ProgressUpdateResponse = ApiResponse<ProgressUpdateResponsePayload | null>;

export interface TaskDetailProjectPayload {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  techStack: Project['techStack'];
  status: Project['status'];
  classification: Project['classification'];
}

export interface TaskDetailResponsePayload {
  id: Task['id'];
  title: Task['title'];
  status: Task['status'];
  project: TaskDetailProjectPayload;
  resources: ResourceResponse[];
  /** Null when nobody has claimed the task. */
  assigneeId: string | null;
  assigneeName: string | null;
}

export type GetTaskDetailResponse = ApiResponse<TaskDetailResponsePayload>;

export interface UpdateTaskStatusResponsePayload {
  taskId: Task['id'];
  taskTitle: Task['title'];
  projectTitle: Project['title'];
  newStatus: Task['status'];
}

export type UpdateTaskStatusResponse = ApiResponse<UpdateTaskStatusResponsePayload>;

export interface ArchiveProjectResponsePayload {
  id: Project['id'];
  status: Project['status'];
}

export type ArchiveProjectResponse = ApiResponse<ArchiveProjectResponsePayload>;

export interface PipelineEventPayload {
  id: ProjectEvent['id'];
  stage: PipelineStage;
  message: ProjectEvent['message'];
  createdAt: string;
}

export interface ProjectPipelineResponsePayload {
  projectId: Project['id'];
  projectTitle: Project['title'];
  events: PipelineEventPayload[];
}

export type GetProjectPipelineResponse = ApiResponse<ProjectPipelineResponsePayload>;

export interface UpdateProjectResponsePayload {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  techStack: Project['techStack'];
}

export type UpdateProjectResponse = ApiResponse<UpdateProjectResponsePayload>;

export interface ProjectTaskResponse {
  id: Task['id'];
  title: Task['title'];
  status: Task['status'];
  plannedFor: string | null;
  createdAt: string;
  /** Null when nobody has claimed the task. */
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface ProjectDetailResponsePayload {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  techStack: Project['techStack'];
  classification: Project['classification'];
  status: Project['status'];
  resources: ResourceResponse[];
  tasks: ProjectTaskResponse[];
}

export type GetProjectDetailResponse = ApiResponse<ProjectDetailResponsePayload>;

/* ── Collaboration ─────────────────────────────────────────────────────── */

export interface ProjectMemberResponse {
  userId: ProjectMember['userId'];
  name: User['name'];
  email: User['email'];
  role: ProjectMember['role'];
  joinedAt: string;
  /** True for the member making the request, so the UI can label "you". */
  isSelf: boolean;
}

export type GetProjectMembersResponse = ApiResponse<ProjectMemberResponse[]>;

export interface CreateInviteResponsePayload {
  code: ProjectInvite['code'];
  expiresAt: string;
  /** Deep link for sharing: blisp://invite/<code> */
  shareUrl: string;
}

export type CreateInviteResponse = ApiResponse<CreateInviteResponsePayload>;

/** Preview shown before joining, so a user knows what they are accepting. */
export interface InvitePreviewPayload {
  code: ProjectInvite['code'];
  projectTitle: Project['title'];
  projectDescription: Project['description'];
  memberCount: number;
  invitedBy: User['name'];
  /** True when the requester already belongs — the UI can skip the join step. */
  alreadyMember: boolean;
}

export type GetInvitePreviewResponse = ApiResponse<InvitePreviewPayload>;

export interface AcceptInviteResponsePayload {
  projectId: Project['id'];
  projectTitle: Project['title'];
  role: ProjectMember['role'];
  /** Who issued the invite, so the joiner sees a name rather than an id. */
  invitedBy: User['name'];
}

export type AcceptInviteResponse = ApiResponse<AcceptInviteResponsePayload>;

export type RemoveMemberResponse = ApiResponse<{ userId: string }>;

/* ── Targeted invites ──────────────────────────────────────────────────── */

/** An invite addressed to one person, rather than a shareable code. */
export interface TargetedInvitePayload {
  id: ProjectInvite['id'];
  projectId: Project['id'];
  projectTitle: Project['title'];
  status: InviteStatus;
  /** Who sent it — a name, never a raw Clerk id. */
  invitedBy: User['name'];
  invitedUserId: string;
  invitedUserName: User['name'];
  expiresAt: string;
  createdAt: string;
}

export type SendUserInviteResponse = ApiResponse<TargetedInvitePayload>;

/** An incoming invite as the recipient sees it, with enough to decide on. */
export interface PendingInvitePayload {
  id: ProjectInvite['id'];
  projectId: Project['id'];
  projectTitle: Project['title'];
  projectDescription: Project['description'];
  memberCount: number;
  invitedBy: User['name'];
  expiresAt: string;
  createdAt: string;
}

export type GetPendingInvitesResponse = ApiResponse<PendingInvitePayload[]>;

/** An outgoing invite as the sender sees it, for "invited, awaiting reply". */
export interface OutgoingInvitePayload {
  id: ProjectInvite['id'];
  status: InviteStatus;
  invitedUserId: string;
  invitedUserName: User['name'];
  invitedUserEmail: User['email'];
  invitedBy: User['name'];
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
}

export type GetProjectInvitesResponse = ApiResponse<OutgoingInvitePayload[]>;

export type AcceptTargetedInviteResponse = ApiResponse<AcceptInviteResponsePayload>;
export type DeclineInviteResponse = ApiResponse<{ id: string }>;
export type RevokeInviteResponse = ApiResponse<{ id: string }>;

export interface AssignTaskResponsePayload {
  taskId: Task['id'];
  taskTitle: Task['title'];
  assigneeId: string | null;
  assigneeName: string | null;
}

export type AssignTaskResponse = ApiResponse<AssignTaskResponsePayload>;

export interface MemberProgress {
  userId: string;
  name: User['name'];
  role: ProjectMember['role'];
  assigned: number;
  done: number;
  inProgress: number;
  todo: number;
}

export interface ProjectProgressPayload {
  overall: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    /** 0-100, rounded. Convenience for progress bars. */
    percentComplete: number;
  };
  perMember: MemberProgress[];
  /** Tasks nobody has claimed — the team's shared backlog. */
  unassigned: number;
}

export type GetProjectProgressResponse = ApiResponse<ProjectProgressPayload>;

export interface TaskCommentResponse {
  id: string;
  body: string;
  authorId: string;
  /** Byline as it was when written; see the snapshot note on TaskComment. */
  authorName: string;
  createdAt: string;
  updatedAt: string;
  /** True for the requester's own comments, so the UI can offer edit/delete. */
  isOwn: boolean;
  /** Members named with @ in the body, resolved to ids the client can link. */
  mentionedUserIds: string[];
}

export type GetTaskCommentsResponse = ApiResponse<TaskCommentResponse[]>;
export type CreateTaskCommentResponse = ApiResponse<TaskCommentResponse>;
export type UpdateTaskCommentResponse = ApiResponse<TaskCommentResponse>;
export type DeleteTaskCommentResponse = ApiResponse<{ id: string }>;

/* ── Notifications ─────────────────────────────────────────────────────── */

export interface NotificationResponse {
  id: Notification['id'];
  title: Notification['title'];
  message: Notification['message'];
  /** In-app route to open on tap, e.g. /project/:id or /task/:id. */
  url: Notification['url'];
  type: NotificationType;
  /** Null while unread; the timestamp it was read otherwise. */
  readAt: string | null;
  /** Set only on PROJECT_INVITE rows, which carry accept/decline. */
  inviteId: Notification['inviteId'];
  createdAt: string;
}

export interface NotificationListPayload {
  notifications: NotificationResponse[];
  pagination: PaginationInfo;
  /** Badge total across all rows — independent of paging and filters. */
  unreadCount: number;
}

export type GetNotificationsResponse = ApiResponse<NotificationListPayload>;
export type MarkNotificationReadResponse = ApiResponse<{
  id: string;
  unreadCount: number;
}>;
export type MarkAllNotificationsReadResponse = ApiResponse<{ updated: number }>;
export type DismissNotificationResponse = ApiResponse<{
  id: string;
  unreadCount: number;
}>;
