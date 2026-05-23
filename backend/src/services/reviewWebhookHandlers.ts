import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, stakes } from '../db/schema';
import { enqueuePromptStake } from './queue';

export type ApprovedReviewInput = {
  reviewerLogin: string;
  repoSlug: string;
  prId: number;
  prTitle?: string;
};

export async function handleApprovedReviewSubmitted(input: ApprovedReviewInput): Promise<{ queued: boolean; reason?: string }> {
  if (!input.reviewerLogin || !input.repoSlug || !input.prId) {
    return { queued: false, reason: 'missing_required_fields' };
  }

  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.slug, input.repoSlug), eq(repos.stakeEnabled, true)),
  });

  if (!repo) {
    return { queued: false, reason: 'repo_not_enabled' };
  }

  const minStakeUsdc = repo.minStakeUsdc ?? 10_000_000;
  const reviewerAddr = `github:${input.reviewerLogin}`;
  const stakeId = `pending:${input.repoSlug}:${input.prId}:${input.reviewerLogin}`;

  await db
    .insert(stakes)
    .values({
      stakeId,
      reviewerAddr,
      repoId: repo.id,
      prId: input.prId,
      prTitle: input.prTitle,
      amountUsdc: minStakeUsdc,
      state: 'pending_stake',
    })
    .onConflictDoNothing({ target: stakes.stakeId });

  await enqueuePromptStake({
    reviewerLogin: input.reviewerLogin,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc,
  });

  return { queued: true };
}
