import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { stakes } from '../db/schema';

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
};

const defaultDeps: Dependencies = {
  findPendingStakeByStakeId: async (stakeId: string) => {
    const rows = await db
      .select({
        id: stakes.id,
        amountUsdc: stakes.amountUsdc,
        stakedAt: stakes.stakedAt,
      })
      .from(stakes)
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

  return { ok: true };
}
