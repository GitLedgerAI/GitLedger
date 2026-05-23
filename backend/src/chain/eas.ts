import { encodeAbiParameters, keccak256, toBytes } from 'viem';

export type EASAttestationPayload = {
  basename: string;
  repoSlug: string;
  prId: bigint;
  stakeAmount: bigint;
  verdict: 'ACTIVE' | 'CLEAN' | 'SLASHED';
  reviewedAt: bigint;
  resolvedAt: bigint;
  reputationDelta: bigint;
  repoLanguages: string;
};

export function hashBasename(basename: string): `0x${string}` {
  return keccak256(toBytes(basename));
}

export function encodeEasPayload(payload: EASAttestationPayload): `0x${string}` {
  return encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'string' },
    ],
    [
      hashBasename(payload.basename),
      payload.repoSlug,
      payload.prId,
      payload.stakeAmount,
      payload.verdict,
      payload.reviewedAt,
      payload.resolvedAt,
      payload.reputationDelta,
      payload.repoLanguages,
    ],
  );
}
