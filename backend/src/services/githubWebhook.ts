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
  pull_request?: { number?: number };
};

export type GitHubInstallationEvent = {
  action?: string;
  installation?: { id?: number };
};

export function isApprovedReviewSubmission(eventName: string | null, payload: GitHubReviewEvent): boolean {
  return (
    eventName === 'pull_request_review' &&
    payload.action === 'submitted' &&
    payload.review?.state?.toLowerCase() === 'approved'
  );
}

export function isInstallationCreated(eventName: string | null, payload: GitHubInstallationEvent): boolean {
  return eventName === 'installation' && payload.action === 'created' && typeof payload.installation?.id === 'number';
}
