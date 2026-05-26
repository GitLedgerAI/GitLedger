// services/lifecycle.ts — central stake-lifecycle DB writer.
//
// Every state transition (activation, slash, clean release) flows through one
// of three functions here. They keep four tables in sync:
//   1. stakes              — canonical state machine row
//   2. attestations        — UI-facing per-PR record (powers live feed + history)
//   3. attestation_events  — append-only timeseries (powers activity timelines)
//   4. reviewers           — rollup counters + reputation score
//
// Reputation formula (intentionally simple for MVP):
//   - +20 on CLEAN release
//   - -50 on SLASH
//   - Clamped to [0, 1000]; starting baseline is 500 (set in schema default).
//
// All writes happen as a single drizzle transaction so partial failures don't
// desync the tables.

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { attestationEvents, attestations, reviewers, stakes } from '../db/schema';
import { getLanguages, getRepo } from './githubApi';
import { onReviewClean, onReviewSlashed, onStakeLocked } from './enterpriseEvents';

export type ActivatedInput = {
  stakeId: string;
  reviewerAddr: string;
  repoSlug: string;
  prId: number;
  prTitle?: string | null;
  amountUsdc: number;
  attestationUid: string;
  txHashStake: string;
  windowEndsAt: Date;
};

export type SlashedInput = {
  stakeId: string;
  reviewerAddr: string;
  repoSlug: string;
  prId: number;
  amountUsdc: number;
  attestationUid: string;
  txHashResolve: string;
};

export type CleanInput = {
  stakeId: string;
  reviewerAddr: string;
  repoSlug: string;
  prId: number;
  amountUsdc: number;
  attestationUid: string;
  yieldEarnedUsdc: number;
  txHashResolve: string;
};

const REPUTATION_MIN = 0;
const REPUTATION_MAX = 1000;
const REPUTATION_DELTA_CLEAN = 20;
const REPUTATION_DELTA_SLASH = -50;

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Record a stake transition pending → active.
 * The stakes row is already flipped by activateStake(); this writes the rest:
 * attestation row, timeseries event, reviewer rollup.
 */
export async function recordStakeActivated(input: ActivatedInput): Promise<void> {
  console.log('[lifecycle] recordStakeActivated', {
    stakeId: input.stakeId,
    reviewer: input.reviewerAddr,
    repoSlug: input.repoSlug,
    prId: input.prId,
    amountUsdc: input.amountUsdc,
  });

  const reviewerRow = await db.query.reviewers.findFirst({
    where: eq(reviewers.address, input.reviewerAddr),
  });
  const basename = reviewerRow?.basename ?? null;
  const reviewedAt = new Date();

  // Fetch the repo's language list from GitHub. Best-effort: if the API call
  // fails, we still record the activation; the language fields stay empty.
  let repoLanguages: string[] = [];
  try {
    const repoInfo = await getRepo(input.repoSlug);
    if (repoInfo?.languagesUrl) {
      repoLanguages = await getLanguages(repoInfo.languagesUrl);
    }
    console.log('[lifecycle] fetched repo languages', {
      repoSlug: input.repoSlug,
      languages: repoLanguages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[lifecycle] failed to fetch repo languages — continuing without them', {
      repoSlug: input.repoSlug,
      error: message,
    });
  }

  const existingLanguages = reviewerRow?.languages ?? [];
  const mergedLanguages = Array.from(new Set([...existingLanguages, ...repoLanguages]));
  const reviewerLanguagesChanged =
    repoLanguages.length > 0 && mergedLanguages.length !== existingLanguages.length;

  await db.transaction(async (tx) => {
    await tx
      .insert(attestations)
      .values({
        uid: input.attestationUid,
        basename,
        reviewerAddress: input.reviewerAddr,
        repoSlug: input.repoSlug,
        prId: input.prId,
        prTitle: input.prTitle ?? null,
        stakeAmount: input.amountUsdc,
        verdict: 'ACTIVE',
        reviewedAt,
        reputationDelta: 0,
        repoLanguages,
        txHash: input.txHashStake,
      })
      .onConflictDoNothing({ target: attestations.uid });

    await tx.insert(attestationEvents).values({
      reviewerAddr: input.reviewerAddr,
      repoSlug: input.repoSlug,
      prId: input.prId,
      eventType: 'stake',
      amountUsdc: input.amountUsdc,
      attestationUid: input.attestationUid,
      txHash: input.txHashStake,
    });

    await tx
      .update(reviewers)
      .set({
        totalStakedUsdc: sql`coalesce(${reviewers.totalStakedUsdc}, 0) + ${input.amountUsdc}`,
        lastActiveAt: reviewedAt,
        ...(reviewerLanguagesChanged ? { languages: mergedLanguages } : {}),
      })
      .where(eq(reviewers.address, input.reviewerAddr));
  });

  console.log('[lifecycle] activation recorded', {
    stakeId: input.stakeId,
    languagesAdded: repoLanguages,
    reviewerLanguagesNow: mergedLanguages,
  });

  // Track 1 compliance hook (fire-and-forget; failures already logged).
  void onStakeLocked({
    repoSlug: input.repoSlug,
    prId: input.prId,
    reviewerAddr: input.reviewerAddr,
    reviewerBasename: basename,
    amountUsdc: input.amountUsdc,
    attestationUid: input.attestationUid,
  });
}

/**
 * Record a stake transition active → slashed.
 * Flips the stakes row, marks the attestation, appends an event, applies slash
 * penalty to reviewer rollups + reputation.
 */
export async function recordStakeSlashed(input: SlashedInput): Promise<void> {
  console.log('[lifecycle] recordStakeSlashed', {
    stakeId: input.stakeId,
    reviewer: input.reviewerAddr,
    prId: input.prId,
    amountUsdc: input.amountUsdc,
  });

  const resolvedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(stakes)
      .set({ state: 'slashed', txHashResolve: input.txHashResolve, resolvedAt })
      .where(eq(stakes.stakeId, input.stakeId));

    await tx
      .update(attestations)
      .set({
        verdict: 'SLASHED',
        resolvedAt,
        reputationDelta: REPUTATION_DELTA_SLASH,
        txHash: input.txHashResolve,
      })
      .where(eq(attestations.uid, input.attestationUid));

    await tx.insert(attestationEvents).values({
      reviewerAddr: input.reviewerAddr,
      repoSlug: input.repoSlug,
      prId: input.prId,
      eventType: 'slash',
      amountUsdc: input.amountUsdc,
      attestationUid: input.attestationUid,
      txHash: input.txHashResolve,
    });

    const current = await tx.query.reviewers.findFirst({
      where: eq(reviewers.address, input.reviewerAddr),
    });
    const newRep = clamp(
      (current?.reputationScore ?? 500) + REPUTATION_DELTA_SLASH,
      REPUTATION_MIN,
      REPUTATION_MAX,
    );

    await tx
      .update(reviewers)
      .set({
        slashCount: sql`coalesce(${reviewers.slashCount}, 0) + 1`,
        totalSlashedUsdc: sql`coalesce(${reviewers.totalSlashedUsdc}, 0) + ${input.amountUsdc}`,
        reputationScore: newRep,
      })
      .where(eq(reviewers.address, input.reviewerAddr));
  });

  console.log('[lifecycle] slash recorded', { stakeId: input.stakeId, txHash: input.txHashResolve });

  // Track 1 compliance hook: SOC sees the slash via SIEM in real time.
  const slashRow = await db.query.reviewers.findFirst({
    where: eq(reviewers.address, input.reviewerAddr),
  });
  void onReviewSlashed({
    repoSlug: input.repoSlug,
    prId: input.prId,
    reviewerAddr: input.reviewerAddr,
    reviewerBasename: slashRow?.basename ?? null,
    amountUsdc: input.amountUsdc,
    attestationUid: input.attestationUid,
  });
}

/**
 * Record a stake transition active → clean (yield released).
 */
export async function recordStakeClean(input: CleanInput): Promise<void> {
  console.log('[lifecycle] recordStakeClean', {
    stakeId: input.stakeId,
    reviewer: input.reviewerAddr,
    prId: input.prId,
    amountUsdc: input.amountUsdc,
    yieldEarnedUsdc: input.yieldEarnedUsdc,
  });

  const resolvedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(stakes)
      .set({
        state: 'clean',
        txHashResolve: input.txHashResolve,
        resolvedAt,
        yieldEarned: input.yieldEarnedUsdc,
      })
      .where(eq(stakes.stakeId, input.stakeId));

    await tx
      .update(attestations)
      .set({
        verdict: 'CLEAN',
        resolvedAt,
        reputationDelta: REPUTATION_DELTA_CLEAN,
        txHash: input.txHashResolve,
      })
      .where(eq(attestations.uid, input.attestationUid));

    await tx.insert(attestationEvents).values({
      reviewerAddr: input.reviewerAddr,
      repoSlug: input.repoSlug,
      prId: input.prId,
      eventType: 'clean',
      amountUsdc: input.amountUsdc,
      attestationUid: input.attestationUid,
      txHash: input.txHashResolve,
    });

    const current = await tx.query.reviewers.findFirst({
      where: eq(reviewers.address, input.reviewerAddr),
    });
    const newRep = clamp(
      (current?.reputationScore ?? 500) + REPUTATION_DELTA_CLEAN,
      REPUTATION_MIN,
      REPUTATION_MAX,
    );

    await tx
      .update(reviewers)
      .set({
        cleanCount: sql`coalesce(${reviewers.cleanCount}, 0) + 1`,
        totalYieldUsdc: sql`coalesce(${reviewers.totalYieldUsdc}, 0) + ${input.yieldEarnedUsdc}`,
        reputationScore: newRep,
      })
      .where(eq(reviewers.address, input.reviewerAddr));
  });

  console.log('[lifecycle] clean release recorded', { stakeId: input.stakeId, txHash: input.txHashResolve });

  // Track 1 compliance hook.
  const cleanRow = await db.query.reviewers.findFirst({
    where: eq(reviewers.address, input.reviewerAddr),
  });
  void onReviewClean({
    repoSlug: input.repoSlug,
    prId: input.prId,
    reviewerAddr: input.reviewerAddr,
    reviewerBasename: cleanRow?.basename ?? null,
    amountUsdc: input.amountUsdc,
    attestationUid: input.attestationUid,
  });
}
