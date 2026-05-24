export type Verdict = 'ACTIVE' | 'CLEAN' | 'SLASHED';
export type StakeState = 'active' | 'clean' | 'slashed';
export type SortKey = 'score' | 'yield' | 'accuracy' | 'stakes';

export interface Reviewer {
  address: string;
  basename: string;
  githubLogin: string;
  reputationScore: number;
  totalStakedUsdc: number;
  totalYieldUsdc: number;
  totalSlashedUsdc: number;
  cleanCount: number;
  slashCount: number;
  languages: string[];
  lastActiveAt: string;
  createdAt: string;
  percentile?: number;
  accuracyRate?: number;
}

export interface Attestation {
  uid: string;
  basename: string;
  reviewerAddress: string;
  repoSlug: string;
  prId: number;
  prTitle: string;
  stakeAmount: number;
  verdict: Verdict;
  reviewedAt: string;
  resolvedAt?: string;
  reputationDelta: number;
  repoLanguages: string[];
  txHash: string;
}

export interface Stake {
  id: string;
  stakeId: string;
  reviewerAddr: string;
  repoSlug?: string;
  prId: number;
  prTitle?: string | null;
  amountUsdc: number;
  state: StakeState;
  attestationUid?: string | null;
  yieldEarned?: number | null;
  windowEndsAt: string;
  stakedAt: string;
  resolvedAt?: string | null;
}

export interface Repo {
  slug: string;
  name?: string;
  owner?: string;
  language?: string;
  stars?: number;
  trustScore?: number;
  totalStaked?: number;
  reviewCount?: number;
  totalReviews?: number;
  activeReviews?: number;
  slashCount?: number;
  slashRate?: number;
  description?: string;
  minStakeUsdc?: number;
  stakeEnabled?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  reviewer: Reviewer;
  totalStaked: number;
  totalYield: number;
  accuracy: number;
  topLanguage: string;
}

export interface PrDetails {
  prId: number;
  prTitle: string;
  repoSlug: string;
  minStakeUsdc: number;
  stakeEnabled: boolean;
}
