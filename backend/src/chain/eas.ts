import { encodeAbiParameters, keccak256, toBytes } from 'viem';

export type EASAttestationPayload = {
  stakeId: `0x${string}`;
  reviewer: `0x${string}`;
  verdict: 'ACTIVE' | 'CLEAN' | 'SLASHED';
  prHash: `0x${string}`;
};

export function hashBasename(basename: string): `0x${string}` {
  return keccak256(toBytes(basename));
}

export function encodeEasPayload(payload: EASAttestationPayload): `0x${string}` {
  return encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'address' },
      { type: 'string' },
      { type: 'bytes32' },
    ],
    [
      payload.stakeId,
      payload.reviewer,
      payload.verdict,
      payload.prHash,
    ],
  );
}

export function hashPr(repoSlug: string, prId: number): `0x${string}` {
  return keccak256(toBytes(`${repoSlug}:${prId}`));
}
