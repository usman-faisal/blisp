import type {
  AddEvidenceResponse,
  GetProjectVerificationResponse,
  GetTaskVerificationResponse,
  LinkRepositoryResponse,
  ListRepositoriesResponse,
  SyncRepositoryResponse,
  UnlinkRepositoryResponse,
} from '@repo/types';
import { apiClient } from './client';

/**
 * Repository linking and completion verification.
 *
 * Read-only against GitHub: nothing here can create a commit, branch or PR.
 * The user pushes with git as they normally would, and BLISP only observes
 * the result — which is what makes the evidence independent of the app that
 * reports on it.
 */

const base = (projectId: string) => `/projects/${projectId}/github`;

export async function linkRepository(projectId: string, repository: string, token?: string) {
  const response = await apiClient.post<LinkRepositoryResponse>(`${base(projectId)}/repositories`, {
    repository,
    ...(token ? { token } : {}),
  });
  return response.data;
}

export async function listRepositories(projectId: string) {
  const response = await apiClient.get<ListRepositoriesResponse>(`${base(projectId)}/repositories`);
  return response.data;
}

export async function unlinkRepository(projectId: string, repositoryId: string) {
  const response = await apiClient.delete<UnlinkRepositoryResponse>(
    `${base(projectId)}/repositories/${repositoryId}`,
  );
  return response.data;
}

export async function syncRepository(projectId: string, repositoryId: string) {
  const response = await apiClient.post<SyncRepositoryResponse>(
    `${base(projectId)}/repositories/${repositoryId}/sync`,
    {},
    // A sync walks a page of commits and re-judges every task it touches, so
    // it runs longer than a normal request.
    { timeout: 45_000 },
  );
  return response.data;
}

export async function getProjectVerification(projectId: string) {
  const response = await apiClient.get<GetProjectVerificationResponse>(`${base(projectId)}/verification`);
  return response.data;
}

export async function getTaskVerification(projectId: string, taskId: string) {
  const response = await apiClient.get<GetTaskVerificationResponse>(
    `${base(projectId)}/tasks/${taskId}/verification`,
  );
  return response.data;
}

export async function addEvidence(projectId: string, taskId: string, url: string, title?: string) {
  const response = await apiClient.post<AddEvidenceResponse>(`${base(projectId)}/tasks/${taskId}/evidence`, {
    url,
    ...(title ? { title } : {}),
  });
  return response.data;
}

export async function removeEvidence(projectId: string, evidenceId: string) {
  const response = await apiClient.delete(`${base(projectId)}/github/evidence/${evidenceId}`);
  return response.data;
}

/**
 * The token a user puts in a commit message to link it to a task.
 *
 * Must stay identical to taskReference() in the backend matcher: the app shows
 * this string and the server looks for it, so a difference between them means
 * nothing ever verifies. Duplicated rather than imported because @repo/types
 * holds types, not logic, and the rule is three lines.
 */
export function taskReference(taskId: string): string {
  return `BLISP-${taskId.replace(/-/g, '').slice(0, 8)}`;
}
