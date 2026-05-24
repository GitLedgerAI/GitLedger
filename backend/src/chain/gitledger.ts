import { decodeEventLog, keccak256, toHex } from 'viem';
import { env } from '../config/env';
import { gitLedgerAbi } from './abi';
import { basePublicClient, baseWalletClient } from './client';
import { encodeEasPayload, hashPr } from './eas';

const contractAddress = env.GITLEDGER_CONTRACT as `0x${string}`;

export async function writeStakeReview(params: {
  stakeId: `0x${string}`;
  reviewer: `0x${string}`;
  repoSlug: string;
  prId: number;
  amountUsdc: bigint;
  windowDurationSeconds?: number;
  yieldBps?: number;
}) {
  const schemaData = encodeEasPayload({
    stakeId: params.stakeId,
    reviewer: params.reviewer,
    verdict: 'ACTIVE',
    prHash: hashPr(params.repoSlug, params.prId),
  });

  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'stakeReview',
    args: [
      params.stakeId,
      params.reviewer,
      params.amountUsdc,
      BigInt(params.windowDurationSeconds ?? 30 * 24 * 60 * 60),
      params.yieldBps ?? 500,
      schemaData,
    ],
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });

  let stakeId: `0x${string}` | null = null;
  let attestationUid: `0x${string}` | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [
          {
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
          },
        ],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Staked') {
        stakeId = decoded.args.stakeId as `0x${string}`;
        attestationUid = decoded.args.easUid as `0x${string}`;
        break;
      }
    } catch {
      continue;
    }
  }

  return { txHash: hash, stakeId, attestationUid };
}

export async function writeSlashReview(params: {
  stakeId: `0x${string}`;
  reporter: `0x${string}`;
  reviewer: `0x${string}`;
  repoSlug: string;
  prId: number;
}) {
  const schemaData = encodeEasPayload({
    stakeId: params.stakeId,
    reviewer: params.reviewer,
    verdict: 'SLASHED',
    prHash: hashPr(params.repoSlug, params.prId),
  });

  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'slashReview',
    args: [params.stakeId, params.reporter, schemaData],
  });

  return { txHash: hash };
}

export async function writeReleaseYield(params: {
  stakeId: `0x${string}`;
  reviewer: `0x${string}`;
  repoSlug: string;
  prId: number;
}) {
  const schemaData = encodeEasPayload({
    stakeId: params.stakeId,
    reviewer: params.reviewer,
    verdict: 'CLEAN',
    prHash: hashPr(params.repoSlug, params.prId),
  });

  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'releaseYield',
    args: [params.stakeId, schemaData],
  });

  return { txHash: hash };
}

export function derivePendingStakeId(reviewerAddress: `0x${string}`, prId: bigint): `0x${string}` {
  return keccak256(toHex(`${reviewerAddress}:${prId}`));
}
