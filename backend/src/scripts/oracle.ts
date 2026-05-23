import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { stakes } from '../db/schema';
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

const due = await db
  .select()
  .from(stakes)
  .where(and(eq(stakes.state, 'active'), isNotNull(stakes.windowEndsAt), lte(stakes.windowEndsAt, new Date())));

for (const s of due) {
  if (!s.stakeId) continue;
  const hotfix = await checkHotfix((s as any).repoSlug ?? '', s.prId);
  if (hotfix.found) {
    // Reporter address resolution is not yet implemented; use treasury as placeholder to keep path functional.
    await writeSlashReview({ stakeId: s.stakeId as `0x${string}`, reporter: env.TREASURY_ADDRESS as `0x${string}` });
    console.info('[oracle] slashed stake', { stakeId: s.stakeId });
  } else {
    await writeReleaseYield({ stakeId: s.stakeId as `0x${string}` });
    console.info('[oracle] released stake', { stakeId: s.stakeId });
  }
}
