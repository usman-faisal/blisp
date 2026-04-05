import type { 
  Task, 
  DailyPlan, 
  Resource, 
  Project, 
  BrainDump,
  User
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

export interface ProjectResponse {
  id: Project['id'];
  title: Project['title'];
  description: Project['description'];
  techStack: Project['techStack'];
  resources: ResourceResponse[];
  status: Project['status'];
  classification: Project['classification'];
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
