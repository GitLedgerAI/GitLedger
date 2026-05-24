import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { repos, reviewers, stakes } from '../db/schema';
import { env } from '../config/env';
import { writeReleaseYield, writeSlashReview } from '../chain/gitledger';

function isHotfixTitle(title: string): boolean {
  return /hotfix|fix|patch|revert/i.test(title);
}

async function checkHotfix(repoSlug: string, prId: number): Promise<{ found: boolean; reporter?: string }> {
  const [owner, repo] = repoSlug.split('/');
  const q = encodeURIComponent(`repo:${owner}/${repo} is:pr is:merged`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=20&sort=updated`, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return { found: false };
  const data = (await res.json()) as { items?: Array<{ title?: string; body?: string; user?: { login?: string } }> };
  const hit = (data.items ?? []).find((i) => isHotfixTitle(i.title ?? '') && (i.body ?? '').includes(String(prId)));
  return hit ? { found: true, reporter: hit.user?.login } : { found: false };
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
  const hotfix = await checkHotfix(repoSlug, s.stakes.prId);
  if (hotfix.found) {
    const reporterAddress = await resolveReporterAddress(hotfix.reporter);
    await writeSlashReview({ stakeId: s.stakes.stakeId as `0x${string}`, reporter: reporterAddress });
    console.info('[oracle] slashed stake', { stakeId: s.stakes.stakeId, reporter: reporterAddress });
  } else {
    await writeReleaseYield({ stakeId: s.stakes.stakeId as `0x${string}` });
    console.info('[oracle] released stake', { stakeId: s.stakes.stakeId });
  }
}
