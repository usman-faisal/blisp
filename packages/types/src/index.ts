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
} from '@repo/db';

export interface ApiResponse<T = void> {
  data: T;
  message: string;
  success: boolean;
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
