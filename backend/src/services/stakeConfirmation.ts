import { writeStakeReview } from '../chain/gitledger';
import { activatePendingStake } from './stakeResolution';

export type ConfirmStakeInput = {
  stakeId: string;
  reviewerAddress: `0x${string}`;
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
  attestationUid?: string | null;
}> {
  if (!input.stakeId || !input.reviewerBasename || !input.repoSlug || !input.prId || !input.amountUsdc) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const onchain = await writeStakeReview({
    stakeId: input.stakeId as `0x${string}`,
    reviewer: input.reviewerAddress,
    repoSlug: input.repoSlug,
    prId: input.prId,
    amountUsdc: BigInt(input.amountUsdc),
  });

  if (!onchain.attestationUid) {
    return { ok: false, reason: 'attestation_uid_unavailable' };
  }

  const activated = await activatePendingStake({
    stakeId: input.stakeId,
    txHashStake: onchain.txHash,
    attestationUid: onchain.attestationUid,
    amountUsdc: input.amountUsdc,
  });

  if (!activated.ok) return activated;

  return {
    ok: true,
    txHash: onchain.txHash,
    onchainStakeId: onchain.stakeId,
    attestationUid: onchain.attestationUid,
  };
}
