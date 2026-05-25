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
    const now = new Date();
    const rows = await db
      .select({
        stakeId: stakes.stakeId,
        reviewerAddr: stakes.reviewerAddr,
        prId: stakes.prId,
        windowEndsAt: stakes.windowEndsAt,
      })
      .from(stakes)
      .leftJoin(repos, eq(stakes.repoId, repos.id))
      .where(and(eq(repos.slug, repoSlug), eq(stakes.state, 'active'), gt(stakes.windowEndsAt, now)));
    console.log('[hotfix] db query: active stakes', {
      repoSlug,
      now: now.toISOString(),
      rowCount: rows.length,
      rows: rows.map((r) => ({
        stakeId: r.stakeId,
        prId: r.prId,
        reviewerAddr: r.reviewerAddr,
        windowEndsAt: r.windowEndsAt?.toISOString?.() ?? null,
      })),
    });
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
      if (addr?.startsWith('0x')) {
        console.log('[hotfix] reporter has linked wallet — bounty goes to reviewer addr', {
          reporterLogin,
          reporterAddress: addr,
        });
        return addr as `0x${string}`;
      }
      console.log('[hotfix] reporter not onboarded (no 0x address) — bounty falls back to treasury', {
        reporterLogin,
        placeholderAddress: addr ?? null,
      });
    } else {
      console.log('[hotfix] no reporter login on event — bounty falls back to treasury');
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
  console.log('[hotfix] handler entered', {
    repoSlug: input.repoSlug,
    prId: input.prId,
    prTitle: input.prTitle,
    reporterLogin: input.reporterLogin,
    hasBody: !!input.prBody,
  });

  if (!input.repoSlug || !input.prId) {
    console.warn('[hotfix] rejected: missing required fields', { repoSlug: input.repoSlug, prId: input.prId });
    return { considered: false, reason: 'missing_required_fields', slashed: [] };
  }
  if (!isHotfixTitle(input.prTitle ?? '')) {
    console.log('[hotfix] not a hotfix title — skipping', { prId: input.prId, prTitle: input.prTitle });
    return { considered: false, reason: 'not_hotfix_title', slashed: [] };
  }

  console.log('[hotfix] title matched /hotfix/ — searching active stakes', {
    repoSlug: input.repoSlug,
    prId: input.prId,
  });

  const active = await deps.findActiveStakesForRepo(input.repoSlug);
  console.log('[hotfix] active-stakes query result', {
    repoSlug: input.repoSlug,
    activeCount: active.length,
    stakeIds: active.map((s) => s.stakeId),
  });

  if (active.length === 0) {
    console.log('[hotfix] no active stakes in this repo — nothing to slash', { repoSlug: input.repoSlug });
    return { considered: true, reason: 'no_active_stakes', slashed: [] };
  }

  const reporterAddress = await deps.resolveReporterAddress(input.reporterLogin);
  console.log('[hotfix] reporter address resolved', {
    reporterLogin: input.reporterLogin,
    reporterAddress,
  });

  const slashed: HotfixHandlerResult['slashed'] = [];

  for (const stake of active) {
    if (stake.prId === input.prId) {
      console.log('[hotfix] skipping stake: PR is its own hotfix candidate', { stakeId: stake.stakeId, prId: stake.prId });
      continue;
    }
    if (!stake.reviewerAddr.startsWith('0x')) {
      console.log('[hotfix] skipping stake: placeholder reviewer (no onchain address)', {
        stakeId: stake.stakeId,
        reviewerAddr: stake.reviewerAddr,
      });
      continue;
    }

    console.log('[hotfix] evaluating stake against hotfix PR', {
      stakeId: stake.stakeId,
      stakedPrId: stake.prId,
      hotfixPrId: input.prId,
    });

    const match = await deps.matchesStakedPr({
      repoSlug: input.repoSlug,
      hotfixPrId: input.prId,
      hotfixBody: input.prBody,
      stakedPrId: stake.prId,
    });

    console.log('[hotfix] matcher result', {
      stakeId: stake.stakeId,
      stakedPrId: stake.prId,
      matches: match.matches,
      reason: match.reason,
    });

    if (!match.matches || !match.reason) {
      console.log('[hotfix] no match — stake not slashable for this PR', {
        stakeId: stake.stakeId,
        stakedPrId: stake.prId,
      });
      continue;
    }

    console.log('[hotfix] match confirmed — submitting slashReview tx', {
      stakeId: stake.stakeId,
      reviewer: stake.reviewerAddr,
      reporter: reporterAddress,
      stakedPrId: stake.prId,
      matchReason: match.reason,
    });

    let result: { txHash: string };
    try {
      result = await deps.slashReview({
        stakeId: stake.stakeId as `0x${string}`,
        reporter: reporterAddress,
        reviewer: stake.reviewerAddr as `0x${string}`,
        repoSlug: input.repoSlug,
        prId: stake.prId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[hotfix] slashReview tx FAILED', {
        stakeId: stake.stakeId,
        stakedPrId: stake.prId,
        error: message,
      });
      throw err;
    }

    console.log('[hotfix] slashReview tx confirmed', {
      stakeId: stake.stakeId,
      txHash: result.txHash,
    });

    await deps.markSlashed(stake.stakeId, result.txHash);
    console.log('[hotfix] DB row marked slashed', {
      stakeId: stake.stakeId,
      txHash: result.txHash,
    });

    slashed.push({
      stakeId: stake.stakeId,
      reviewerAddr: stake.reviewerAddr,
      stakedPrId: stake.prId,
      matchReason: match.reason,
      txHash: result.txHash,
    });
  }

  console.log('[hotfix] handler complete', {
    repoSlug: input.repoSlug,
    hotfixPrId: input.prId,
    slashedCount: slashed.length,
    slashedStakeIds: slashed.map((s) => s.stakeId),
  });

  return { considered: true, slashed };
}
