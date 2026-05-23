export type StakeState = 'active' | 'slashed' | 'released';

export type PromptStakeJob = {
  reviewerLogin: string;
  repoSlug: string;
  prId: number;
  minStakeUsdc: number;
};
