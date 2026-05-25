import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, reviewers, stakes } from '../db/schema';
import { env } from '../config/env';
import { writeReleaseYield, writeSlashReview } from '../chain/gitledger';
import { hotfixMatchesStakedPr, isHotfixTitle } from '../services/hotfixDetection';

type CandidateHotfix = {
  number: number;
  title: string;
  body: string;
  reporter?: string;
};

async function listRecentMergedPrs(repoSlug: string): Promise<CandidateHotfix[]> {
  const [owner, repo] = repoSlug.split('/');
  const q = encodeURIComponent(`repo:${owner}/${repo} is:pr is:merged`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=20&sort=updated`, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ number?: number; title?: string; body?: string | null; user?: { login?: string } }>;
  };
  return (data.items ?? [])
    .filter((i) => typeof i.number === 'number' && isHotfixTitle(i.title ?? ''))
    .map((i) => ({
      number: i.number!,
      title: i.title ?? '',
      body: i.body ?? '',
      reporter: i.user?.login,
    }));
}

async function findHotfixForStake(
  repoSlug: string,
  stakedPrId: number,
): Promise<{ found: boolean; reporter?: string }> {
  const candidates = await listRecentMergedPrs(repoSlug);
  for (const c of candidates) {
    if (c.number === stakedPrId) continue;
    const match = await hotfixMatchesStakedPr({
      repoSlug,
      hotfixPrId: c.number,
      hotfixBody: c.body,
      stakedPrId,
    });
    if (match.matches) return { found: true, reporter: c.reporter };
  }
  return { found: false };
}

async function resolveReporterAddress(githubLogin?: string): Promise<`0x${string}`> {
  if (githubLogin) {
    const reporter = await db
      .select({ address: reviewers.address })
      .from(reviewers)
      .where(eq(reviewers.githubLogin, githubLogin))
      .limit(1);
    const address = reporter[0]?.address;
    if (address?.startsWith('0x')) return address as `0x${string}`;
  }
  return env.TREASURY_ADDRESS as `0x${string}`;
}

const due = await db
  .select()
  .from(stakes)
  .leftJoin(repos, eq(stakes.repoId, repos.id))
  .where(and(eq(stakes.state, 'active'), isNotNull(stakes.windowEndsAt), lte(stakes.windowEndsAt, new Date())));

for (const s of due) {
  if (!s.stakes.stakeId) continue;
  const repoSlug = s.repos?.slug ?? '';
  if (!repoSlug) continue;
  const reviewer = s.stakes.reviewerAddr;
  if (!reviewer?.startsWith('0x')) continue;
  const hotfix = await findHotfixForStake(repoSlug, s.stakes.prId);
  if (hotfix.found) {
    const reporterAddress = await resolveReporterAddress(hotfix.reporter);
    await writeSlashReview({
      stakeId: s.stakes.stakeId as `0x${string}`,
      reporter: reporterAddress,
      reviewer: reviewer as `0x${string}`,
      repoSlug,
      prId: s.stakes.prId,
    });
    console.info('[oracle] slashed stake', { stakeId: s.stakes.stakeId, reporter: reporterAddress });
  } else {
    await writeReleaseYield({
      stakeId: s.stakes.stakeId as `0x${string}`,
      reviewer: reviewer as `0x${string}`,
      repoSlug,
      prId: s.stakes.prId,
    });
    console.info('[oracle] released stake', { stakeId: s.stakes.stakeId });
  }
}
