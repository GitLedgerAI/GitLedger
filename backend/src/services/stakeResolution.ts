import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, stakes } from '../db/schema';
import { recordStakeActivated } from './lifecycle';

export type ActivatePendingStakeInput = {
  stakeId: string;
  txHashStake: string;
  attestationUid: string;
  amountUsdc?: number;
  windowEndsAt?: Date;
};

type PendingStakeRecord = {
  id: string;
  amountUsdc: number;
  stakedAt: Date | null;
  reviewerAddr: string;
  prId: number;
  prTitle: string | null;
  repoSlug: string | null;
};

type Dependencies = {
  findPendingStakeByStakeId: (stakeId: string) => Promise<PendingStakeRecord | null>;
  activateStake: (params: {
    stakeId: string;
    txHashStake: string;
    attestationUid: string;
    amountUsdc: number;
    windowEndsAt: Date;
  }) => Promise<void>;
  recordActivated: typeof recordStakeActivated;
};

const defaultDeps: Dependencies = {
  findPendingStakeByStakeId: async (stakeId: string) => {
    const rows = await db
      .select({
        id: stakes.id,
        amountUsdc: stakes.amountUsdc,
        stakedAt: stakes.stakedAt,
        reviewerAddr: stakes.reviewerAddr,
        prId: stakes.prId,
        prTitle: stakes.prTitle,
        repoSlug: repos.slug,
      })
      .from(stakes)
      .leftJoin(repos, eq(stakes.repoId, repos.id))
      .where(and(eq(stakes.stakeId, stakeId), eq(stakes.state, 'pending_stake')))
      .limit(1);
    return rows[0] ?? null;
  },
  activateStake: async ({ stakeId, txHashStake, attestationUid, amountUsdc, windowEndsAt }) => {
    await db
      .update(stakes)
      .set({
        state: 'active',
        txHashStake,
        attestationUid,
        amountUsdc,
        stakedAt: new Date(),
        windowEndsAt,
      })
      .where(eq(stakes.stakeId, stakeId));
  },
  recordActivated: recordStakeActivated,
};

export async function activatePendingStake(
  input: ActivatePendingStakeInput,
  deps: Dependencies = defaultDeps,
): Promise<{ ok: boolean; reason?: string }> {
  console.log('[stake-resolve] activatePendingStake invoked', {
    stakeId: input.stakeId,
    txHashStake: input.txHashStake,
    hasAttestationUid: !!input.attestationUid,
    amountUsdc: input.amountUsdc,
  });

  if (!input.stakeId || !input.txHashStake || !input.attestationUid) {
    console.warn('[stake-resolve] rejected: missing required fields', input);
    return { ok: false, reason: 'missing_required_fields' };
  }

  const pending = await deps.findPendingStakeByStakeId(input.stakeId);
  if (!pending) {
    console.warn('[stake-resolve] no pending stake row found (already activated or wrong id?)', {
      stakeId: input.stakeId,
    });
    return { ok: false, reason: 'pending_stake_not_found' };
  }

  const baseAmount = input.amountUsdc ?? pending.amountUsdc;
  const windowEndsAt =
    input.windowEndsAt ??
    (() => {
      const now = new Date();
      const d = new Date(now);
      d.setDate(now.getDate() + 30);
      return d;
    })();

  console.log('[stake-resolve] flipping stake to active', {
    stakeId: input.stakeId,
    amountUsdc: baseAmount,
    windowEndsAt: windowEndsAt.toISOString(),
  });

  await deps.activateStake({
    stakeId: input.stakeId,
    txHashStake: input.txHashStake,
    attestationUid: input.attestationUid,
    amountUsdc: baseAmount,
    windowEndsAt,
  });

  console.log('[stake-resolve] stake row now active', {
    stakeId: input.stakeId,
    windowEndsAt: windowEndsAt.toISOString(),
  });

  if (pending.repoSlug && pending.reviewerAddr) {
    try {
      await deps.recordActivated({
        stakeId: input.stakeId,
        reviewerAddr: pending.reviewerAddr,
        repoSlug: pending.repoSlug,
        prId: pending.prId,
        prTitle: pending.prTitle,
        amountUsdc: baseAmount,
        attestationUid: input.attestationUid,
        txHashStake: input.txHashStake,
        windowEndsAt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[stake-resolve] lifecycle recordStakeActivated failed (state row already flipped)', {
        stakeId: input.stakeId,
        error: message,
      });
      // Don't throw — the stake IS active onchain and in stakes table. Lifecycle
      // side-effects are best-effort and can be backfilled.
    }
  } else {
    console.warn('[stake-resolve] missing repoSlug/reviewerAddr — skipping lifecycle write', {
      stakeId: input.stakeId,
      hasRepoSlug: !!pending.repoSlug,
      hasReviewerAddr: !!pending.reviewerAddr,
    });
  }

  return { ok: true };
}
