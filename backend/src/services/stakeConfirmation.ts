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
  if (!input.stakeId || !input.txHash) {
    return { ok: false, code: 'BAD_REQUEST', reason: 'missing_required_fields' };
  }

  const pending = await db.query.stakes.findFirst({ where: eq(stakes.stakeId, input.stakeId) });
  if (!pending) return { ok: false, code: 'BAD_REQUEST', reason: 'unknown_stake' };

  // Idempotency: same stake already activated with same tx → return existing.
  if (
    pending.state === 'active' &&
    pending.txHashStake === input.txHash &&
    pending.attestationUid
  ) {
    return { ok: true, txHash: pending.txHashStake, attestationUid: pending.attestationUid };
  }

  if ((pending.reviewerAddr ?? '').toLowerCase() !== input.reviewerAddress.toLowerCase()) {
    return { ok: false, code: 'FORBIDDEN', reason: 'reviewer_mismatch' };
  }

  let receipt;
  try {
    receipt = await basePublicClient.waitForTransactionReceipt({ hash: input.txHash, timeout: 60_000 });
  } catch {
    return { ok: false, code: 'BAD_REQUEST', reason: 'tx_not_found' };
  }

  if (receipt.status !== 'success') {
    return { ok: false, code: 'BAD_REQUEST', reason: 'tx_reverted' };
  }

  const expectedContract = env.GITLEDGER_CONTRACT.toLowerCase();
  if ((receipt.to ?? '').toLowerCase() !== expectedContract) {
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
    return { ok: false, code: 'BAD_REQUEST', reason: 'staked_event_not_found' };
  }

  if (onchainStakeId.toLowerCase() !== input.stakeId.toLowerCase()) {
    return { ok: false, code: 'BAD_REQUEST', reason: 'stake_id_mismatch' };
  }
  if (onchainReviewer.toLowerCase() !== input.reviewerAddress.toLowerCase()) {
    return { ok: false, code: 'BAD_REQUEST', reason: 'event_reviewer_mismatch' };
  }
  if (onchainPrincipal !== BigInt(pending.amountUsdc)) {
    return { ok: false, code: 'BAD_REQUEST', reason: 'principal_mismatch' };
  }

  const activated = await activatePendingStake({
    stakeId: input.stakeId,
    txHashStake: input.txHash,
    attestationUid,
    amountUsdc: Number(onchainPrincipal),
  });
  if (!activated.ok) {
    return { ok: false, code: 'BAD_REQUEST', reason: activated.reason ?? 'activation_failed' };
  }

  return { ok: true, txHash: input.txHash, attestationUid };
}
