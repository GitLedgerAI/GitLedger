import type { Reviewer, Attestation, Stake, Repo, Verdict } from './types';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-uuq8.onrender.com').replace(/\/$/, '');

// tRPC v11 batch wire format (default transformer — no SuperJSON `json` wrapper)
async function trpcQuery<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const inputParam = encodeURIComponent(JSON.stringify({ '0': input }));
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1&input=${inputParam}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 500)}`);
  }
  const batch: [{ result: { data: T } }] = await res.json();
  return batch[0].result.data;
}

const walletHeader = (addr: string | null | undefined): Record<string, string> =>
  addr ? { 'x-wallet-address': addr.toLowerCase() } : {};

export async function getGitHubAppInstallStatus(githubLogin: string): Promise<{
  ok: boolean;
  githubLogin: string;
  installed: boolean;
  installUrl: string;
}> {
  const res = await fetch(
    `${BASE}/auth/github/install-status?github_login=${encodeURIComponent(githubLogin)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[auth.github.install-status] ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{ ok: boolean; githubLogin: string; installed: boolean; installUrl: string }>;
}

export async function linkWalletToGithubSession(githubLogin: string, walletAddress: string): Promise<{
  ok: boolean;
  githubLogin: string;
  walletAddress: string;
}> {
  const res = await fetch(`${BASE}/auth/github/link-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubLogin, walletAddress }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[auth.github.link-wallet] ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<{ ok: boolean; githubLogin: string; walletAddress: string }>;
}

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
  if (!basename) return Promise.reject(new Error('basename is required'));
  return trpcQuery<Reviewer>('reviewer.getByBasename', { basename });
}

export function getReviewerAttestations(
  basename: string,
  verdict?: Verdict | 'ALL',
): Promise<Attestation[]> {
  if (!basename) return Promise.reject(new Error('basename is required'));
  return trpcQuery<Attestation[]>('reviewer.getAttestations', {
    basename,
    ...(verdict && verdict !== 'ALL' ? { verdict } : {}),
  });
}

async function trpcMutate<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ '0': input }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 500)}`);
  }
  const batch: [{ result: { data: T } }] = await res.json();
  return batch[0].result.data;
}

// ── stake ────────────────────────────────────────────────────────────────────

export function getMyStakes(address: string): Promise<Stake[]> {
  return trpcQuery<Stake[]>('stake.getMyStakes', { address }, walletHeader(address));
}

export function prepareStake(params: {
  stakeId: string;
  repoSlug: string;
  prId: number;
  amountUsdc: number;
  walletAddress: string;
}): Promise<{
  contractAddress: `0x${string}`;
  windowDurationSeconds: number;
  yieldBps: number;
  schemaData: `0x${string}`;
}> {
  return trpcMutate(
    'stake.prepare',
    {
      stakeId: params.stakeId,
      repoSlug: params.repoSlug,
      prId: params.prId,
      amountUsdc: params.amountUsdc,
    },
    walletHeader(params.walletAddress),
  );
}

export function submitStake(params: {
  stakeId: string;
  txHash: string;
  walletAddress: string;
}): Promise<{ attestationUid: string; txHash: string }> {
  return trpcMutate(
    'stake.submit',
    { stakeId: params.stakeId, txHash: params.txHash },
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
