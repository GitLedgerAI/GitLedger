import { hashBasename } from '../chain/eas';
import { writeStakeReview } from '../chain/gitledger';
import { activatePendingStake } from './stakeResolution';

export type ConfirmStakeInput = {
  stakeId: string;
  reviewerBasename: string;
  repoSlug: string;
  prId: number;
  amountUsdc: number;
};

export async function confirmStakeOnchainAndActivate(input: ConfirmStakeInput): Promise<{
  ok: boolean;
  reason?: string;
  txHash?: string;
  onchainStakeId?: string | null;
}> {
  if (!input.stakeId || !input.reviewerBasename || !input.repoSlug || !input.prId || !input.amountUsdc) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const onchain = await writeStakeReview({
    basenameHash: hashBasename(input.reviewerBasename),
    repoSlug: input.repoSlug,
    prId: BigInt(input.prId),
    amountUsdc: BigInt(input.amountUsdc),
  });

  const activated = await activatePendingStake({
    stakeId: input.stakeId,
    txHashStake: onchain.txHash,
    // Placeholder until EAS attestation UID is read from emitted events or downstream EAS indexing.
    attestationUid: onchain.stakeId ?? '0x0000000000000000000000000000000000000000000000000000000000000000',
    amountUsdc: input.amountUsdc,
  });

  if (!activated.ok) return activated;

  return {
    ok: true,
    txHash: onchain.txHash,
    onchainStakeId: onchain.stakeId,
  };
}
