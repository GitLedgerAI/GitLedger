import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, reviewers, stakes } from '../db/schema';
import { enqueuePromptStake } from './queue';
import { deriveStakeId } from './stakeId';

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
  upsertReviewerByGithubLogin: (githubLogin: string) => Promise<string>;
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
  findEnabledRepoBySlug: async (slug: string) => {
    const rows = await db
      .select({ id: repos.id, minStakeUsdc: repos.minStakeUsdc })
      .from(repos)
      .where(and(eq(repos.slug, slug), eq(repos.stakeEnabled, true)))
      .limit(1);
    return rows[0] ?? null;
  },
  upsertReviewerByGithubLogin: async (githubLogin: string) => {
    const placeholderAddress = `github:${githubLogin}`;
    const now = new Date();

    // Insert-or-skip: tolerates concurrent webhook deliveries racing on the same
    // github_login (or address PK). No-op when either unique constraint fires.
    await db
      .insert(reviewers)
      .values({ address: placeholderAddress, githubLogin, lastActiveAt: now })
      .onConflictDoNothing();

    const row = await db.query.reviewers.findFirst({
      where: eq(reviewers.githubLogin, githubLogin),
    });
    if (!row) throw new Error(`failed to upsert reviewer for github_login=${githubLogin}`);

    await db
      .update(reviewers)
      .set({ lastActiveAt: now })
      .where(eq(reviewers.githubLogin, githubLogin));

    return row.address;
  },
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
    console.log('[github-webhook] approved-review skipped (repo not enabled)', {
      reviewerLogin: input.reviewerLogin,
      repoSlug: input.repoSlug,
      prId: input.prId,
    });
    return { queued: false, reason: 'repo_not_enabled' };
  }

  const minStakeUsdc = repo.minStakeUsdc ?? 500_000;
  const stakeId = deriveStakeId(input.repoSlug, input.prId, input.reviewerLogin);

  const reviewerAddr = await deps.upsertReviewerByGithubLogin(input.reviewerLogin);

  await deps.insertPendingStake({
    stakeId,
    reviewerAddr,
    repoId: repo.id,
    prId: input.prId,
    prTitle: input.prTitle,
    amountUsdc: minStakeUsdc,
  });

  console.log('[github-webhook] approved-review pending stake inserted', {
    stakeId,
    reviewerLogin: input.reviewerLogin,
    reviewerAddr,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc,
  });

  await deps.enqueuePromptStake({
    reviewerLogin: input.reviewerLogin,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc,
  });

  console.log('[github-webhook] approved-review prompt-stake enqueued', {
    stakeId,
    reviewerLogin: input.reviewerLogin,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc,
  });

  return { queued: true };
}
