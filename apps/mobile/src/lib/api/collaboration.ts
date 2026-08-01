import { apiClient } from './client';
import type {
  AcceptInviteResponse,
  AssignTaskResponse,
  CreateInviteResponse,
  CreateTaskCommentResponse,
  DeleteTaskCommentResponse,
  GetInvitePreviewResponse,
  GetProjectMembersResponse,
  GetProjectProgressResponse,
  GetTaskCommentsResponse,
  RemoveMemberResponse,
  UpdateTaskCommentResponse,
} from '@repo/types';

/**
 * List a project's members.
 * GET /projects/:id/members
 */
export const getProjectMembers = async (
  projectId: string,
): Promise<GetProjectMembersResponse> => {
  const response = await apiClient.get<GetProjectMembersResponse>(
    `/projects/${projectId}/members`,
  );
  return response.data;
};

/**
 * Create a share code for a project. Any member may invite.
 * POST /projects/:id/invites
 */
export const createInvite = async (projectId: string): Promise<CreateInviteResponse> => {
  const response = await apiClient.post<CreateInviteResponse>(
    `/projects/${projectId}/invites`,
  );
  return response.data;
};

/**
 * Look up an invite before joining, so the user sees what they are accepting.
 * GET /invites/:code
 */
export const getInvitePreview = async (code: string): Promise<GetInvitePreviewResponse> => {
  const response = await apiClient.get<GetInvitePreviewResponse>(`/invites/${code}`);
  return response.data;
};

/**
 * Join a project with a share code.
 * POST /invites/:code/accept
 */
export const acceptInvite = async (code: string): Promise<AcceptInviteResponse> => {
  const response = await apiClient.post<AcceptInviteResponse>(`/invites/${code}/accept`);
  return response.data;
};

/**
 * Overall and per-member completion for a project.
 * GET /projects/:id/progress
 */
export const getProjectProgress = async (
  projectId: string,
): Promise<GetProjectProgressResponse> => {
  const response = await apiClient.get<GetProjectProgressResponse>(
    `/projects/${projectId}/progress`,
  );
  return response.data;
};

/**
 * Assign a task to a member, or pass null to return it to the backlog.
 * Any member may reassign.
 * PATCH /tasks/:id/assign
 */
export const assignTask = async (
  taskId: string,
  assigneeId: string | null,
): Promise<AssignTaskResponse> => {
  const response = await apiClient.patch<AssignTaskResponse>(`/tasks/${taskId}/assign`, {
    assigneeId,
  });
  return response.data;
};

/**
 * A task's comments, oldest first.
 * GET /tasks/:id/comments
 */
export const getTaskComments = async (taskId: string): Promise<GetTaskCommentsResponse> => {
  const response = await apiClient.get<GetTaskCommentsResponse>(`/tasks/${taskId}/comments`);
  return response.data;
};

/**
 * Comment on a task. Mentioning a member with @their name notifies them.
 * POST /tasks/:id/comments
 */
export const createTaskComment = async (
  taskId: string,
  body: string,
): Promise<CreateTaskCommentResponse> => {
  const response = await apiClient.post<CreateTaskCommentResponse>(
    `/tasks/${taskId}/comments`,
    { body },
  );
  return response.data;
};

/**
 * Edit your own comment. Author only.
 * PATCH /comments/:id
 */
export const updateTaskComment = async (
  commentId: string,
  body: string,
): Promise<UpdateTaskCommentResponse> => {
  const response = await apiClient.patch<UpdateTaskCommentResponse>(`/comments/${commentId}`, {
    body,
  });
  return response.data;
};

/**
 * Delete a comment — the author, or the project owner moderating.
 * DELETE /comments/:id
 */
export const deleteTaskComment = async (
  commentId: string,
): Promise<DeleteTaskCommentResponse> => {
  const response = await apiClient.delete<DeleteTaskCommentResponse>(`/comments/${commentId}`);
  return response.data;
};

/**
 * Remove a member. Owner only.
 * DELETE /projects/:id/members/:userId
 */
export const removeMember = async (
  projectId: string,
  userId: string,
): Promise<RemoveMemberResponse> => {
  const response = await apiClient.delete<RemoveMemberResponse>(
    `/projects/${projectId}/members/${userId}`,
  );
  return response.data;
};
