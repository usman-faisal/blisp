import { apiClient } from './client';
import type {
  ApproveResearchReportResponse,
  CancelResearchReportResponse,
  RejectResearchReportResponse,
  GetResearchReportResponse,
  GetResearchReportVersionsResponse,
  RequestResearchReportResponse,
} from '@repo/types';

/**
 * Queue a new report version.
 *
 * Returns as soon as the PENDING row is written — generation itself runs on the
 * queue and takes 60-100 seconds, so the caller must poll rather than await the
 * finished report. A 409 means one is already in flight for this project.
 * POST /projects/:projectId/research-report
 */
export const requestResearchReport = async (
  projectId: string,
): Promise<RequestResearchReportResponse> => {
  const response = await apiClient.post<RequestResearchReportResponse>(
    `/projects/${projectId}/research-report`,
  );
  return response.data;
};

/**
 * Latest report for a project, whatever its status. `data` is null when the
 * project has never had one generated.
 * GET /projects/:projectId/research-report
 */
export const getLatestResearchReport = async (
  projectId: string,
): Promise<GetResearchReportResponse> => {
  const response = await apiClient.get<GetResearchReportResponse>(
    `/projects/${projectId}/research-report`,
  );
  return response.data;
};

/**
 * Version metadata, newest first. Omits the sections payload, so this is the
 * cheap call behind the version switcher.
 * GET /projects/:projectId/research-report/versions
 */
export const getResearchReportVersions = async (
  projectId: string,
): Promise<GetResearchReportVersionsResponse> => {
  const response = await apiClient.get<GetResearchReportVersionsResponse>(
    `/projects/${projectId}/research-report/versions`,
  );
  return response.data;
};

/**
 * One version in full.
 * GET /projects/:projectId/research-report/:version
 */
export const getResearchReportVersion = async (
  projectId: string,
  version: number,
): Promise<GetResearchReportResponse> => {
  const response = await apiClient.get<GetResearchReportResponse>(
    `/projects/${projectId}/research-report/${version}`,
  );
  return response.data;
};

/**
 * Mark a version as the approved one. Any previously approved version is
 * demoted to DRAFT but keeps its content.
 * POST /projects/:projectId/research-report/:version/approve
 */
export const approveResearchReport = async (
  projectId: string,
  version: number,
): Promise<ApproveResearchReportResponse> => {
  const response = await apiClient.post<ApproveResearchReportResponse>(
    `/projects/${projectId}/research-report/${version}/approve`,
  );
  return response.data;
};

/**
 * Turn a version down, optionally saying why.
 *
 * The version stays readable; the reason is fed into the next generation as
 * stated feedback, so rejecting improves the next attempt.
 * POST /projects/:projectId/research-report/:version/reject
 */
export const rejectResearchReport = async (
  projectId: string,
  version: number,
  reason?: string,
): Promise<RejectResearchReportResponse> => {
  const response = await apiClient.post<RejectResearchReportResponse>(
    `/projects/${projectId}/research-report/${version}/reject`,
    { reason },
  );
  return response.data;
};

/**
 * Stop a report that is still generating.
 *
 * Returns once the row is marked CANCELLED. A job that has already started
 * cannot be recalled, so its result is discarded on arrival rather than saved.
 * POST /projects/:projectId/research-report/:version/cancel
 */
export const cancelResearchReport = async (
  projectId: string,
  version: number,
): Promise<CancelResearchReportResponse> => {
  const response = await apiClient.post<CancelResearchReportResponse>(
    `/projects/${projectId}/research-report/${version}/cancel`,
  );
  return response.data;
};
