import { describe, expect, test } from 'bun:test';
import { handleApprovedReviewSubmitted } from '../src/services/reviewWebhookHandlers';

describe('handleApprovedReviewSubmitted', () => {
  test('returns repo_not_enabled when repo is missing or disabled', async () => {
    const result = await handleApprovedReviewSubmitted(
      { reviewerLogin: 'alice', repoSlug: 'org/repo', prId: 42 },
      {
        findEnabledRepoBySlug: async () => null,
        insertPendingStake: async () => {},
        enqueuePromptStake: async () => {},
      },
    );

    expect(result).toEqual({ queued: false, reason: 'repo_not_enabled' });
  });

  test('creates pending stake and enqueues prompt for enabled repo', async () => {
    let inserted: Record<string, unknown> | null = null;
    let enqueued: Record<string, unknown> | null = null;

    const result = await handleApprovedReviewSubmitted(
      { reviewerLogin: 'bob', repoSlug: 'gitledger/repo', prId: 77, prTitle: 'Fix parser' },
      {
        findEnabledRepoBySlug: async () => ({ id: 'repo-1', minStakeUsdc: 12_000_000 }),
        insertPendingStake: async (params) => {
          inserted = params as unknown as Record<string, unknown>;
        },
        enqueuePromptStake: async (job) => {
          enqueued = job as unknown as Record<string, unknown>;
        },
      },
    );

    expect(result).toEqual({ queued: true });
    expect(inserted).toEqual({
      stakeId: 'pending:gitledger/repo:77:bob',
      reviewerAddr: 'github:bob',
      repoId: 'repo-1',
      prId: 77,
      prTitle: 'Fix parser',
      amountUsdc: 12_000_000,
    });
    expect(enqueued).toEqual({
      reviewerLogin: 'bob',
      repoSlug: 'gitledger/repo',
      prId: 77,
      minStakeUsdc: 12_000_000,
    });
  });
});
