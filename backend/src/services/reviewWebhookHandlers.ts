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

type RepoRecord = {
  id: string;
  minStakeUsdc: number | null;
};

type Dependencies = {
  findEnabledRepoBySlug: (slug: string) => Promise<RepoRecord | null>;
  insertPendingStake: (params: {
    stakeId: string;
    reviewerAddr: string;
    repoId: string;
    prId: number;
    prTitle?: string;
    amountUsdc: number;
  }) => Promise<void>;
  enqueuePromptStake: typeof enqueuePromptStake;
};

const defaultDeps: Dependencies = {
  findEnabledRepoBySlug: async (slug: string) =>
    db.query.repos.findFirst({
      where: and(eq(repos.slug, slug), eq(repos.stakeEnabled, true)),
      columns: { id: true, minStakeUsdc: true },
    }),
  insertPendingStake: async ({ stakeId, reviewerAddr, repoId, prId, prTitle, amountUsdc }) => {
    await db
      .insert(stakes)
      .values({
        stakeId,
        reviewerAddr,
        repoId,
        prId,
        prTitle,
        amountUsdc,
        state: 'pending_stake',
      })
      .onConflictDoNothing({ target: stakes.stakeId });
  },
  enqueuePromptStake,
};

export async function handleApprovedReviewSubmitted(
  input: ApprovedReviewInput,
  deps: Dependencies = defaultDeps,
): Promise<{ queued: boolean; reason?: string }> {
  if (!input.reviewerLogin || !input.repoSlug || !input.prId) {
    return { queued: false, reason: 'missing_required_fields' };
  }

  const repo = await deps.findEnabledRepoBySlug(input.repoSlug);
  if (!repo) {
    return { queued: false, reason: 'repo_not_enabled' };
  }

  const minStakeUsdc = repo.minStakeUsdc ?? 10_000_000;
  const reviewerAddr = `github:${input.reviewerLogin}`;
  const stakeId = `pending:${input.repoSlug}:${input.prId}:${input.reviewerLogin}`;

  await deps.insertPendingStake({
    stakeId,
    reviewerAddr,
    repoId: repo.id,
    prId: input.prId,
    prTitle: input.prTitle,
    amountUsdc: minStakeUsdc,
  });

  await deps.enqueuePromptStake({
    reviewerLogin: input.reviewerLogin,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc,
  });

  return { queued: true };
}
