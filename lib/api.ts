import type { Reviewer, Attestation, Stake, Repo, Verdict } from './types';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-uuq8.onrender.com').replace(/\/$/, '');

// tRPC v11 httpBatchLink wire format
async function trpcQuery<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const inputParam = encodeURIComponent(JSON.stringify({ '0': { json: input } }));
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1&input=${inputParam}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 200)}`);
  }
  const batch: [{ result: { data: unknown } }] = await res.json();
  const data = batch[0]?.result?.data;
  // Handle SuperJSON envelope {json: T} and bare responses equally
  if (data !== null && typeof data === 'object' && 'json' in data) {
    return (data as { json: T }).json;
  }
  return data as T;
}

const walletHeader = (addr: string | null | undefined): Record<string, string> =>
  addr ? { 'x-wallet-address': addr.toLowerCase() } : {};

// ── reviewer ────────────────────────────────────────────────────────────────

export type LeaderboardRow = Reviewer & { rank: number };

export async function getLeaderboard(params: {
  sort?: string;
  lang?: string;
  search?: string;
} = {}): Promise<LeaderboardRow[]> {
  const data = await trpcQuery<Reviewer[]>('reviewer.getLeaderboard', params as Record<string, unknown>);
  return data.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function getReviewerByBasename(basename: string): Promise<Reviewer> {
  return trpcQuery<Reviewer>('reviewer.getByBasename', { basename });
}

export function getReviewerAttestations(
  basename: string,
  verdict?: Verdict | 'ALL',
): Promise<Attestation[]> {
  return trpcQuery<Attestation[]>('reviewer.getAttestations', {
    basename,
    ...(verdict && verdict !== 'ALL' ? { verdict } : {}),
  });
}

// tRPC v11 mutation (POST) wire format
async function trpcMutate<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ '0': { json: input } }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 200)}`);
  }
  const batch: [{ result: { data: unknown } }] = await res.json();
  const data = batch[0]?.result?.data;
  if (data !== null && typeof data === 'object' && 'json' in data) {
    return (data as { json: T }).json;
  }
  return data as T;
}

// ── stake ────────────────────────────────────────────────────────────────────

export function getMyStakes(address: string): Promise<Stake[]> {
  return trpcQuery<Stake[]>('stake.getMyStakes', { address }, walletHeader(address));
}

export function submitStake(params: {
  basename: string;
  repoSlug: string;
  prId: number;
  amountUsdc: number;
  walletAddress: string;
  stakeId: string;
}): Promise<{ attestationUid: string; txHash: string }> {
  return trpcMutate(
    'stake.submit',
    { basename: params.basename, repoSlug: params.repoSlug, prId: params.prId, amountUsdc: params.amountUsdc, stakeId: params.stakeId },
    walletHeader(params.walletAddress),
  );
}

export function getPrDetails(repoSlug: string, prId: number): Promise<{
  prId: number;
  prTitle: string;
  repoSlug: string;
  minStakeUsdc: number;
  stakeEnabled: boolean;
}> {
  return trpcQuery('stake.getPrDetails', { repoSlug, prId });
}

// ── repo ─────────────────────────────────────────────────────────────────────

export function getRepoBySlug(slug: string): Promise<Repo> {
  return trpcQuery<Repo>('repo.getBySlug', { slug });
}

export function getRepoAttestations(
  slug: string,
  verdict?: Verdict | 'ALL',
): Promise<Attestation[]> {
  return trpcQuery<Attestation[]>('repo.getAttestations', {
    slug,
    ...(verdict && verdict !== 'ALL' ? { verdict } : {}),
  });
}

// ── feed ─────────────────────────────────────────────────────────────────────

export type LiveFeedItem = {
  basename: string;
  repoSlug: string;
  prId: number;
  verdict: Verdict;
  stakeAmount: number;
  timestamp: string;
};

export function getLiveFeed(): Promise<LiveFeedItem[]> {
  return trpcQuery<LiveFeedItem[]>('feed.getLive', {});
}
