import { db } from '../db/client';
import { promptStakeNotifications } from '../db/schema';

type PromptStakeNotification = {
  reviewerLogin: string;
  repoSlug: string;
  prId: number;
  minStakeUsdc: number;
  source?: string;
  payload: unknown;
};

export async function recordPromptStakeNotification(input: PromptStakeNotification): Promise<void> {
  await db.insert(promptStakeNotifications).values({
    reviewerLogin: input.reviewerLogin,
    repoSlug: input.repoSlug,
    prId: input.prId,
    minStakeUsdc: input.minStakeUsdc,
    source: input.source ?? 'webhook',
    payload: input.payload as Record<string, unknown>,
  });
}
