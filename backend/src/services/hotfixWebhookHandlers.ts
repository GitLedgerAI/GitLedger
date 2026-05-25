import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, reviewers, stakes } from '../db/schema';
import { env } from '../config/env';
import { writeSlashReview } from '../chain/gitledger';
import { hotfixMatchesStakedPr, isHotfixTitle } from './hotfixDetection';

export type MergedHotfixInput = {
  repoSlug: string;
  prId: number;
  prTitle?: string | null;
  prBody?: string | null;
  /** GitHub login of whoever merged / opened the hotfix; used as the slash reporter. */
  reporterLogin?: string | null;
};

type ActiveStakeRow = {
  stakeId: string;
  reviewerAddr: string;
  prId: number;
};

type Dependencies = {
  findActiveStakesForRepo: (repoSlug: string) => Promise<ActiveStakeRow[]>;
  resolveReporterAddress: (reporterLogin: string | null | undefined) => Promise<`0x${string}`>;
  matchesStakedPr: typeof hotfixMatchesStakedPr;
  slashReview: typeof writeSlashReview;
  markSlashed: (stakeId: string, txHash: string) => Promise<void>;
};

const defaultDeps: Dependencies = {
  findActiveStakesForRepo: async (repoSlug: string) => {
    const rows = await db
      .select({
        stakeId: stakes.stakeId,
        reviewerAddr: stakes.reviewerAddr,
        prId: stakes.prId,
        windowEndsAt: stakes.windowEndsAt,
      })
      .from(stakes)
      .leftJoin(repos, eq(stakes.repoId, repos.id))
      .where(and(eq(repos.slug, repoSlug), eq(stakes.state, 'active'), gt(stakes.windowEndsAt, new Date())));
    return rows.map((r) => ({ stakeId: r.stakeId, reviewerAddr: r.reviewerAddr, prId: r.prId }));
  },
  resolveReporterAddress: async (reporterLogin) => {
    if (reporterLogin) {
      const found = await db
        .select({ address: reviewers.address })
        .from(reviewers)
        .where(eq(reviewers.githubLogin, reporterLogin))
        .limit(1);
      const addr = found[0]?.address;
      if (addr?.startsWith('0x')) return addr as `0x${string}`;
    }
    return env.TREASURY_ADDRESS as `0x${string}`;
  },
  matchesStakedPr: hotfixMatchesStakedPr,
  slashReview: writeSlashReview,
  markSlashed: async (stakeId: string, txHash: string) => {
    await db
      .update(stakes)
      .set({ state: 'slashed', txHashResolve: txHash, resolvedAt: new Date() })
      .where(eq(stakes.stakeId, stakeId));
  },
};

export type HotfixHandlerResult = {
  considered: boolean;
  reason?: string;
  slashed: Array<{ stakeId: string; reviewerAddr: string; stakedPrId: number; matchReason: 'body_ref' | 'file_overlap'; txHash: string }>;
};

export async function handleMergedPullRequest(
  input: MergedHotfixInput,
  deps: Dependencies = defaultDeps,
): Promise<HotfixHandlerResult> {
  if (!input.repoSlug || !input.prId) {
    return { considered: false, reason: 'missing_required_fields', slashed: [] };
  }
  if (!isHotfixTitle(input.prTitle ?? '')) {
    return { considered: false, reason: 'not_hotfix_title', slashed: [] };
  }

  const active = await deps.findActiveStakesForRepo(input.repoSlug);
  if (active.length === 0) {
    return { considered: true, reason: 'no_active_stakes', slashed: [] };
  }

  const reporterAddress = await deps.resolveReporterAddress(input.reporterLogin);
  const slashed: HotfixHandlerResult['slashed'] = [];

  for (const stake of active) {
    if (stake.prId === input.prId) continue; // a PR can't be its own hotfix
    if (!stake.reviewerAddr.startsWith('0x')) continue; // placeholder reviewer can't be slashed onchain

    const match = await deps.matchesStakedPr({
      repoSlug: input.repoSlug,
      hotfixPrId: input.prId,
      hotfixBody: input.prBody,
      stakedPrId: stake.prId,
    });
    if (!match.matches || !match.reason) continue;

    const result = await deps.slashReview({
      stakeId: stake.stakeId as `0x${string}`,
      reporter: reporterAddress,
      reviewer: stake.reviewerAddr as `0x${string}`,
      repoSlug: input.repoSlug,
      prId: stake.prId,
    });
    await deps.markSlashed(stake.stakeId, result.txHash);
    slashed.push({
      stakeId: stake.stakeId,
      reviewerAddr: stake.reviewerAddr,
      stakedPrId: stake.prId,
      matchReason: match.reason,
      txHash: result.txHash,
    });
  }

  return { considered: true, slashed };
}
