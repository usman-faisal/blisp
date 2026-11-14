export const OTP_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // Maximum attempts for OTP verification
// Rate limiting lives in ./throttle.ts and is enforced by UserThrottlerGuard.
// The RATE_LIMIT_* constants that used to sit here were never read by anything.
export const OTP_RESEND_INTERVAL = 60 * 1000; // 1 minute
export const PASSWORD_RESET_TOKEN_EXPIRATION = 15 * 60 * 1000; // 15 minutes

export const API_KEY_HEADER = 'x-api-key';
export const TEAM_ID_HEADER = 'x-team-id';

export const QUEUES = {
  INCUBATOR: 'incubator',
};

export const JOBS = {
  RESEARCH: 'research',
  PLAN: 'plan',
  TASK_RESEARCH: 'task_research',
  // On-demand product discovery report, distinct from RESEARCH (the fast
  // documentation pass that feeds task planning).
  DISCOVERY_REPORT: 'discovery_report',
};
