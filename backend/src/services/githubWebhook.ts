import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyGitHubSignature(signatureHeader: string | null, rawBody: string, secret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const provided = Buffer.from(signatureHeader.replace('sha256=', ''), 'hex');
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'), 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export type GitHubReviewEvent = {
  action: string;
  review?: { state?: string; user?: { login?: string } };
  repository?: { full_name?: string };
  pull_request?: { number?: number; title?: string };
};

export type GitHubPullRequestEvent = {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    merged?: boolean;
    user?: { login?: string };
    merged_by?: { login?: string } | null;
  };
};

export type GitHubInstallationEvent = {
  action?: string;
  installation?: { id?: number };
};

export type GitHubInstallationRepositoriesEvent = {
  action?: string;
  installation?: { id?: number };
  repositories_added?: Array<{ id?: number; full_name?: string }>;
  repositories_removed?: Array<{ id?: number; full_name?: string }>;
};

export function isApprovedReviewSubmission(eventName: string | null, payload: GitHubReviewEvent): boolean {
  return (
    eventName === 'pull_request_review' &&
    payload.action === 'submitted' &&
    payload.review?.state?.toLowerCase() === 'approved'
  );
}

export function isMergedPullRequest(eventName: string | null, payload: GitHubPullRequestEvent): boolean {
  return (
    eventName === 'pull_request' &&
    payload.action === 'closed' &&
    payload.pull_request?.merged === true &&
    typeof payload.pull_request?.number === 'number'
  );
}

export function isInstallationCreated(eventName: string | null, payload: GitHubInstallationEvent): boolean {
  return eventName === 'installation' && payload.action === 'created' && typeof payload.installation?.id === 'number';
}

export function isInstallationDeleted(eventName: string | null, payload: GitHubInstallationEvent): boolean {
  return eventName === 'installation' && payload.action === 'deleted' && typeof payload.installation?.id === 'number';
}

export function isInstallationRepositoriesEvent(
  eventName: string | null,
  payload: GitHubInstallationRepositoriesEvent,
): boolean {
  return (
    eventName === 'installation_repositories' &&
    (payload.action === 'added' || payload.action === 'removed') &&
    typeof payload.installation?.id === 'number'
  );
}
