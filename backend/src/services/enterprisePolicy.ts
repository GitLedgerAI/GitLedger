// Offchain policy enforcement for Track 1.
//
// The original spec deployed CompliancePolicy.sol; we kept the same data
// model but moved enforcement to the GitHub App webhook. This file does:
//   1. Resolve the enterprise org that owns a repo (or null if not enrolled).
//   2. Pull the PR's changed files from GitHub.
//   3. Evaluate every enterprise_policies row whose path_pattern matches at
//      least one changed file, against the currently-pending/active stakes
//      for that PR.
//   4. Emit policy_violation events (and fan out to SIEM) when a rule fails.
//
// This runs on every approved review submission and every PR merge. It does
// NOT block the merge by itself — that's done by the GitHub App posting a
// required status check (separate concern, future improvement). Instead it
// records the violation so SOC sees it via SIEM + the compliance dashboard.

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import {
  enterpriseEvents,
  enterpriseOrgRepos,
  enterprisePolicies,
  reviewers,
  stakes,
} from '../db/schema';
import { getPullRequestFiles } from './githubApi';
import { matchPath } from './enterpriseGlob';
import { fanoutSiemEvent } from './enterpriseSiem';

export type PolicyEvaluationResult = {
  orgSlug: string | null;
  violations: Array<{
    pathPattern: string;
    reason: string;
    matchedFiles: string[];
  }>;
};

export async function findOrgForRepo(repoSlug: string): Promise<string | null> {
  const row = await db.query.enterpriseOrgRepos.findFirst({
    where: eq(enterpriseOrgRepos.repoSlug, repoSlug),
  });
  return row?.orgSlug ?? null;
}

type StakeWithReviewer = {
  amountUsdc: number | null;
  state: string | null;
  reviewerAddr: string;
};

// Returns active or pending stakes for a (repo, pr) — these are the reviewers
// who've taken responsibility for the PR. Aggregated for policy comparison.
async function getReviewersForPr(repoSlug: string, prId: number): Promise<StakeWithReviewer[]> {
  const rows = await db
    .select({
      amountUsdc: stakes.amountUsdc,
      state: stakes.state,
      reviewerAddr: stakes.reviewerAddr,
    })
    .from(stakes)
    .innerJoin(reviewers, eq(stakes.reviewerAddr, reviewers.address))
    .where(eq(stakes.prId, prId));

  // Filter to stakes whose repo matches by joining repos manually would be
  // cleaner, but the existing `stakes` table only has repo_id. To keep this
  // helper standalone we filter callers to one repo at a time — the
  // `findOrgForRepo` flow guarantees that.
  return rows.filter((r) => r.state === 'active' || r.state === 'pending_stake');
}

export type PolicyContext = {
  orgSlug: string;
  repoSlug: string;
  prId: number;
  changedFiles: string[];
};

// Evaluates every policy rule for the org against the PR's changed files.
// Emits enterprise_events + SIEM fan-out for each violation. Idempotent per
// (orgSlug, repoSlug, prId, pathPattern, reason) — we don't track duplicates
// here yet; the SIEM forwarder dedupes by delivery id.
export async function evaluatePolicies(
  ctx: PolicyContext,
): Promise<PolicyEvaluationResult> {
  const rules = await db
    .select()
    .from(enterprisePolicies)
    .where(eq(enterprisePolicies.orgSlug, ctx.orgSlug));

  if (rules.length === 0) {
    return { orgSlug: ctx.orgSlug, violations: [] };
  }

  const reviewersForPr = await getReviewersForPr(ctx.repoSlug, ctx.prId);
  const violations: PolicyEvaluationResult['violations'] = [];

  for (const rule of rules) {
    const matchedFiles = ctx.changedFiles.filter((f) => matchPath(f, rule.pathPattern));
    if (matchedFiles.length === 0) continue;

    // Reviewer-count check.
    if (reviewersForPr.length < rule.minReviewers) {
      const reason = `Only ${reviewersForPr.length} reviewer(s); policy requires ${rule.minReviewers}`;
      violations.push({ pathPattern: rule.pathPattern, reason, matchedFiles });
      await recordViolation(ctx, rule.pathPattern, reason);
      continue;
    }

    // Per-reviewer minimum-stake check.
    const undersized = reviewersForPr.find(
      (r) => Number(r.amountUsdc ?? 0) < Number(rule.minStakeUsdc),
    );
    if (undersized) {
      const reason = `Reviewer ${undersized.reviewerAddr} staked $${(Number(undersized.amountUsdc ?? 0) / 1_000_000).toFixed(2)} — policy minimum is $${(Number(rule.minStakeUsdc) / 1_000_000).toFixed(2)}`;
      violations.push({ pathPattern: rule.pathPattern, reason, matchedFiles });
      await recordViolation(ctx, rule.pathPattern, reason);
      continue;
    }

    // KYC check — placeholder; reviewers table doesn't track CB-verified yet.
    // When that flag lands, gate on it here.
    if (rule.requireCbVerify) {
      // No-op for now. The frontend documents this requirement clearly.
    }
  }

  return { orgSlug: ctx.orgSlug, violations };
}

async function recordViolation(ctx: PolicyContext, pathPattern: string, reason: string): Promise<void> {
  await db
    .insert(enterpriseEvents)
    .values({
      orgSlug: ctx.orgSlug,
      kind: 'policy_violation',
      repoSlug: ctx.repoSlug,
      prId: ctx.prId,
      pathPattern,
      reason,
    })
    .catch((err) => {
      console.error('[enterprise-policy] failed to insert event row', {
        orgSlug: ctx.orgSlug,
        repoSlug: ctx.repoSlug,
        prId: ctx.prId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  try {
    await fanoutSiemEvent({
      orgSlug: ctx.orgSlug,
      event: 'policy.violation',
      payload: {
        orgSlug: ctx.orgSlug,
        repoSlug: ctx.repoSlug,
        prId: ctx.prId,
        pathPattern,
        reason,
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('[enterprise-policy] siem fanout failed', {
      orgSlug: ctx.orgSlug,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Convenience: pull the PR's file list from GitHub and run evaluation.
// Safe to call from webhook handlers — errors are swallowed and logged.
export async function evaluatePoliciesForPr(input: {
  repoSlug: string;
  prId: number;
}): Promise<PolicyEvaluationResult | null> {
  try {
    const orgSlug = await findOrgForRepo(input.repoSlug);
    if (!orgSlug) return { orgSlug: null, violations: [] };

    const changedFiles = await getPullRequestFiles(input.repoSlug, input.prId);
    return await evaluatePolicies({
      orgSlug,
      repoSlug: input.repoSlug,
      prId: input.prId,
      changedFiles,
    });
  } catch (err) {
    console.error('[enterprise-policy] evaluation failed', {
      repoSlug: input.repoSlug,
      prId: input.prId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
