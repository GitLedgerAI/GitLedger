// Helpers that bridge the existing stake lifecycle into Track 1's compliance
// timeline + SIEM fanout. Every helper:
//   1. resolves the enterprise org owning the repo (or no-op if none)
//   2. inserts a row into enterprise_events
//   3. fires SIEM webhooks for that org
//
// All errors are swallowed and logged — the core stake flow must never fail
// because the compliance hook had a hiccup.

import { db } from '../db/client';
import { enterpriseEvents } from '../db/schema';
import { fanoutSiemEvent, type SiemEventKind } from './enterpriseSiem';
import { findOrgForRepo } from './enterprisePolicy';

type Common = {
  repoSlug: string;
  prId: number;
  reviewerAddr: string;
  reviewerBasename?: string | null;
  amountUsdc: number;
  attestationUid: string;
};

async function record(
  kind: 'stake_locked' | 'review_clean' | 'review_slashed',
  siemEvent: SiemEventKind,
  input: Common,
): Promise<void> {
  try {
    const orgSlug = await findOrgForRepo(input.repoSlug);
    if (!orgSlug) return;

    await db.insert(enterpriseEvents).values({
      orgSlug,
      kind,
      repoSlug: input.repoSlug,
      prId: input.prId,
      reviewer: input.reviewerBasename ?? input.reviewerAddr,
      amountUsdc: input.amountUsdc,
      attestationUid: input.attestationUid,
    });

    await fanoutSiemEvent({
      orgSlug,
      event: siemEvent,
      payload: {
        orgSlug,
        repoSlug: input.repoSlug,
        prId: input.prId,
        reviewer: {
          basename: input.reviewerBasename ?? null,
          address: input.reviewerAddr,
        },
        amountUsdc: input.amountUsdc,
        attestationUid: input.attestationUid,
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[enterprise-events] hook failed', {
      kind,
      repoSlug: input.repoSlug,
      prId: input.prId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const onStakeLocked = (input: Common) => record('stake_locked', 'stake.locked', input);
export const onReviewClean = (input: Common) => record('review_clean', 'review.clean', input);
export const onReviewSlashed = (input: Common) => record('review_slashed', 'review.slashed', input);
