import { decodeEventLog } from 'viem';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { basePublicClient } from '../chain/client';
import { db } from '../db/client';
import { stakes } from '../db/schema';
import { activatePendingStake } from './stakeResolution';

const STAKED_EVENT = {
  type: 'event',
  name: 'Staked',
  inputs: [
    { indexed: true, name: 'stakeId', type: 'bytes32' },
    { indexed: true, name: 'reviewer', type: 'address' },
    { indexed: false, name: 'principal', type: 'uint256' },
    { indexed: false, name: 'windowEndsAt', type: 'uint64' },
    { indexed: false, name: 'yieldBps', type: 'uint16' },
    { indexed: false, name: 'easUid', type: 'bytes32' },
  ],
} as const;

export type VerifyStakeInput = {
  stakeId: string;
  txHash: `0x${string}`;
  reviewerAddress: `0x${string}`;
};

export type VerifyStakeFailureCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'NOT_FOUND';

export type VerifyStakeResult =
  | { ok: true; txHash: string; attestationUid: string }
  | { ok: false; code: VerifyStakeFailureCode; reason: string };

export async function verifyAndActivateStake(input: VerifyStakeInput): Promise<VerifyStakeResult> {
  console.log('[stake-confirm] verify request received', {
    stakeId: input.stakeId,
    txHash: input.txHash,
    reviewerAddress: input.reviewerAddress,
  });

  if (!input.stakeId || !input.txHash) {
    console.warn('[stake-confirm] rejected: missing required fields', input);
    return { ok: false, code: 'BAD_REQUEST', reason: 'missing_required_fields' };
  }

  const pending = await db.query.stakes.findFirst({ where: eq(stakes.stakeId, input.stakeId) });
  if (!pending) {
    console.warn('[stake-confirm] unknown stake (no DB row)', { stakeId: input.stakeId });
    return { ok: false, code: 'BAD_REQUEST', reason: 'unknown_stake' };
  }

  console.log('[stake-confirm] DB row found', {
    stakeId: input.stakeId,
    state: pending.state,
    reviewerAddr: pending.reviewerAddr,
    amountUsdc: pending.amountUsdc,
  });

  // Idempotency: same stake already activated with same tx → return existing.
  if (
    pending.state === 'active' &&
    pending.txHashStake === input.txHash &&
    pending.attestationUid
  ) {
    console.log('[stake-confirm] already active — returning cached result (idempotent)', {
      stakeId: input.stakeId,
      txHash: pending.txHashStake,
    });
    return { ok: true, txHash: pending.txHashStake, attestationUid: pending.attestationUid };
  }

  if ((pending.reviewerAddr ?? '').toLowerCase() !== input.reviewerAddress.toLowerCase()) {
    console.warn('[stake-confirm] reviewer mismatch', {
      stakeId: input.stakeId,
      expected: pending.reviewerAddr,
      got: input.reviewerAddress,
    });
    return { ok: false, code: 'FORBIDDEN', reason: 'reviewer_mismatch' };
  }

  console.log('[stake-confirm] awaiting onchain tx receipt', { stakeId: input.stakeId, txHash: input.txHash });
  let receipt;
  try {
    receipt = await basePublicClient.waitForTransactionReceipt({ hash: input.txHash, timeout: 60_000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[stake-confirm] tx not found / receipt timed out', {
      stakeId: input.stakeId,
      txHash: input.txHash,
      error: message,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'tx_not_found' };
  }

  if (receipt.status !== 'success') {
    console.warn('[stake-confirm] tx reverted onchain', {
      stakeId: input.stakeId,
      txHash: input.txHash,
      status: receipt.status,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'tx_reverted' };
  }

  const expectedContract = env.GITLEDGER_CONTRACT.toLowerCase();
  if ((receipt.to ?? '').toLowerCase() !== expectedContract) {
    console.warn('[stake-confirm] tx targeted wrong contract', {
      stakeId: input.stakeId,
      expected: expectedContract,
      got: receipt.to,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'wrong_contract' };
  }

  let onchainStakeId: `0x${string}` | null = null;
  let onchainReviewer: `0x${string}` | null = null;
  let onchainPrincipal: bigint | null = null;
  let attestationUid: `0x${string}` | null = null;

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [STAKED_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Staked') {
        onchainStakeId = decoded.args.stakeId as `0x${string}`;
        onchainReviewer = decoded.args.reviewer as `0x${string}`;
        onchainPrincipal = decoded.args.principal as bigint;
        attestationUid = decoded.args.easUid as `0x${string}`;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!onchainStakeId || !attestationUid || onchainPrincipal == null || !onchainReviewer) {
    console.warn('[stake-confirm] Staked event not found in receipt logs', {
      stakeId: input.stakeId,
      txHash: input.txHash,
      logCount: receipt.logs.length,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'staked_event_not_found' };
  }

  console.log('[stake-confirm] decoded onchain Staked event', {
    stakeId: input.stakeId,
    onchainStakeId,
    onchainReviewer,
    onchainPrincipal: onchainPrincipal.toString(),
    attestationUid,
  });

  if (onchainStakeId.toLowerCase() !== input.stakeId.toLowerCase()) {
    console.warn('[stake-confirm] stake id mismatch (event vs request)', {
      requestStakeId: input.stakeId,
      onchainStakeId,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'stake_id_mismatch' };
  }
  if (onchainReviewer.toLowerCase() !== input.reviewerAddress.toLowerCase()) {
    console.warn('[stake-confirm] event reviewer mismatch', {
      requestReviewer: input.reviewerAddress,
      onchainReviewer,
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'event_reviewer_mismatch' };
  }
  if (onchainPrincipal !== BigInt(pending.amountUsdc)) {
    console.warn('[stake-confirm] principal mismatch (event vs DB)', {
      stakeId: input.stakeId,
      dbAmount: pending.amountUsdc,
      onchainPrincipal: onchainPrincipal.toString(),
    });
    return { ok: false, code: 'BAD_REQUEST', reason: 'principal_mismatch' };
  }

  const activated = await activatePendingStake({
    stakeId: input.stakeId,
    txHashStake: input.txHash,
    attestationUid,
    amountUsdc: Number(onchainPrincipal),
  });
  if (!activated.ok) {
    console.warn('[stake-confirm] activation failed', { stakeId: input.stakeId, reason: activated.reason });
    return { ok: false, code: 'BAD_REQUEST', reason: activated.reason ?? 'activation_failed' };
  }

  console.log('[stake-confirm] stake activated successfully', {
    stakeId: input.stakeId,
    txHash: input.txHash,
    attestationUid,
  });
  return { ok: true, txHash: input.txHash, attestationUid };
}
