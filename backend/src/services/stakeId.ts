import { keccak256, toHex } from 'viem';

export function deriveStakeId(repoSlug: string, prId: number, reviewerLogin: string): `0x${string}` {
  return keccak256(toHex(`${repoSlug}:${prId}:${reviewerLogin.toLowerCase()}`));
}
