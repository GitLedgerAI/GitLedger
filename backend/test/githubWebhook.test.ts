import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { isApprovedReviewSubmission, isInstallationCreated, verifyGitHubSignature } from '../src/services/githubWebhook';

describe('githubWebhook utils', () => {
  test('verifyGitHubSignature validates valid signature', () => {
    const body = JSON.stringify({ hello: 'world' });
    const secret = 'topsecret';
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyGitHubSignature(`sha256=${sig}`, body, secret)).toBe(true);
  });

  test('verifyGitHubSignature rejects invalid signature', () => {
    const body = JSON.stringify({ hello: 'world' });
    expect(verifyGitHubSignature('sha256=deadbeef', body, 'topsecret')).toBe(false);
  });

  test('isApprovedReviewSubmission matches approved events', () => {
    expect(
      isApprovedReviewSubmission('pull_request_review', {
        action: 'submitted',
        review: { state: 'approved' },
      }),
    ).toBe(true);

    expect(
      isApprovedReviewSubmission('pull_request_review', {
        action: 'submitted',
        review: { state: 'commented' },
      }),
    ).toBe(false);
  });

  test('isInstallationCreated matches installation created event', () => {
    expect(
      isInstallationCreated('installation', {
        action: 'created',
        installation: { id: 123 },
      }),
    ).toBe(true);

    expect(
      isInstallationCreated('installation', {
        action: 'deleted',
        installation: { id: 123 },
      }),
    ).toBe(false);
  });
});
