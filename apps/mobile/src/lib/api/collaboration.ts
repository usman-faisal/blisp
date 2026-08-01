import { apiClient } from './client';
import type {
  AcceptInviteResponse,
  CreateInviteResponse,
  GetInvitePreviewResponse,
  GetProjectMembersResponse,
  RemoveMemberResponse,
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
