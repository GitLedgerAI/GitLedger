import { decodeEventLog, keccak256, toHex } from 'viem';
import { env } from '../config/env';
import { gitLedgerAbi } from './abi';
import { basePublicClient, baseWalletClient } from './client';

const contractAddress = env.GITLEDGER_CONTRACT as `0x${string}`;

export async function writeStakeReview(params: {
  basenameHash: `0x${string}`;
  repoSlug: string;
  prId: bigint;
  amountUsdc: bigint;
}) {
  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'stakeReview',
    args: [params.basenameHash, params.repoSlug, params.prId, params.amountUsdc],
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });

  let stakeId: `0x${string}` | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [
          {
            type: 'event',
            name: 'StakeLocked',
            inputs: [
              { indexed: true, name: 'stakeId', type: 'bytes32' },
              { indexed: true, name: 'reviewer', type: 'address' },
              { indexed: false, name: 'amount', type: 'uint256' },
            ],
          },
        ],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'StakeLocked') {
        stakeId = decoded.args.stakeId as `0x${string}`;
        break;
      }
    } catch {
      continue;
    }
  }

  let attestationUid: `0x${string}` | null = null;
  if (stakeId) {
    const stakeRecord = await basePublicClient.readContract({
      address: contractAddress,
      abi: gitLedgerAbi,
      functionName: 'stakes',
      args: [stakeId],
    });

    const uid = stakeRecord[6] as `0x${string}`;
    if (uid && uid !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      attestationUid = uid;
    }
  }

  return { txHash: hash, stakeId, attestationUid };
}

export async function writeSlashReview(params: { stakeId: `0x${string}`; reporter: `0x${string}` }) {
  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'slashReview',
    args: [params.stakeId, params.reporter],
  });

  return { txHash: hash };
}

export async function writeReleaseYield(params: { stakeId: `0x${string}` }) {
  const hash = await baseWalletClient.writeContract({
    address: contractAddress,
    abi: gitLedgerAbi,
    functionName: 'releaseYield',
    args: [params.stakeId],
  });

  return { txHash: hash };
}

export function derivePendingStakeId(reviewerAddress: `0x${string}`, prId: bigint): `0x${string}` {
  return keccak256(toHex(`${reviewerAddress}:${prId}`));
}
