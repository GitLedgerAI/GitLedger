// services/oracleResolver.ts — resolve stakes whose window has elapsed.
//
// For every `state='active'` stake with `windowEndsAt <= now()`:
//   1. Search recent merged PRs in the repo for a hotfix matching the stake.
//   2. If a hotfix was found → call slashReview onchain → record SLASHED in DB.
//   3. Else → read previewYield from contract → call releaseYield onchain →
//      record CLEAN in DB with the exact yield amount.
//
// Used by:
//   - scripts/oracle.ts        (one-shot run)
//   - index.ts setInterval     (background scheduler)
// Both call resolveDueStakes(); concurrency between them is fine because the
// contract rejects double-resolves with StakeNotActive (revert), and the DB
// transition out of 'active' makes the row invisible to the next query.

import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { readPreviewYield, writeReleaseYield, writeSlashReview } from '../chain/gitledger';
import { env } from '../config/env';
import { db } from '../db/client';
import { repos, reviewers, stakes } from '../db/schema';
import { hotfixMatchesStakedPr, isHotfixTitle } from './hotfixDetection';
import { recordStakeClean, recordStakeSlashed } from './lifecycle';

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

export type ResolveResult = {
  considered: number;
  slashed: number;
  cleaned: number;
  errors: Array<{ stakeId: string; error: string }>;
};

export async function resolveDueStakes(): Promise<ResolveResult> {
  const now = new Date();
  console.log('[oracle-resolver] tick', { now: now.toISOString() });

  const due = await db
    .select({
      stakeId: stakes.stakeId,
      prId: stakes.prId,
      reviewerAddr: stakes.reviewerAddr,
      amountUsdc: stakes.amountUsdc,
      attestationUid: stakes.attestationUid,
      repoSlug: repos.slug,
    })
    .from(stakes)
    .leftJoin(repos, eq(stakes.repoId, repos.id))
    .where(and(eq(stakes.state, 'active'), isNotNull(stakes.windowEndsAt), lte(stakes.windowEndsAt, now)));

  console.log('[oracle-resolver] due stakes', {
    count: due.length,
    stakeIds: due.map((d) => d.stakeId),
  });

  const result: ResolveResult = { considered: due.length, slashed: 0, cleaned: 0, errors: [] };

  for (const row of due) {
    const stakeId = row.stakeId;
    if (!stakeId) continue;
    const repoSlug = row.repoSlug ?? '';
    if (!repoSlug) {
      console.warn('[oracle-resolver] skipping stake: missing repoSlug', { stakeId });
      continue;
    }
    const reviewerAddr = row.reviewerAddr;
    if (!reviewerAddr?.startsWith('0x')) {
      console.warn('[oracle-resolver] skipping stake: placeholder reviewer addr', { stakeId, reviewerAddr });
      continue;
    }

    try {
      const hotfix = await findHotfixForStake(repoSlug, row.prId);
      if (hotfix.found) {
        const reporter = await resolveReporterAddress(hotfix.reporter);
        console.log('[oracle-resolver] hotfix found post-window — slashing', {
          stakeId,
          stakedPrId: row.prId,
          reporter,
          reporterLogin: hotfix.reporter,
        });
        const slashTx = await writeSlashReview({
          stakeId: stakeId as `0x${string}`,
          reporter,
          reviewer: reviewerAddr as `0x${string}`,
          repoSlug,
          prId: row.prId,
        });
        await recordStakeSlashed({
          stakeId,
          reviewerAddr,
          repoSlug,
          prId: row.prId,
          amountUsdc: row.amountUsdc,
          attestationUid: row.attestationUid ?? '',
          txHashResolve: slashTx.txHash,
        });
        result.slashed += 1;
      } else {
        const yieldMicro = await readPreviewYield(stakeId as `0x${string}`);
        console.log('[oracle-resolver] clean window — releasing yield', {
          stakeId,
          yieldMicro: yieldMicro.toString(),
        });
        const releaseTx = await writeReleaseYield({
          stakeId: stakeId as `0x${string}`,
          reviewer: reviewerAddr as `0x${string}`,
          repoSlug,
          prId: row.prId,
        });
        await recordStakeClean({
          stakeId,
          reviewerAddr,
          repoSlug,
          prId: row.prId,
          amountUsdc: row.amountUsdc,
          attestationUid: row.attestationUid ?? '',
          yieldEarnedUsdc: Number(yieldMicro),
          txHashResolve: releaseTx.txHash,
        });
        result.cleaned += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[oracle-resolver] stake resolution FAILED', { stakeId, error: message });
      result.errors.push({ stakeId, error: message });
      // Continue with other stakes — one bad row shouldn't poison the batch.
    }
  }

  console.log('[oracle-resolver] tick complete', result);
  return result;
}
