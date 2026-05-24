import type { PromptStakeJob } from '../lib/types';
import { env } from '../config/env';

export async function processPromptStakeJob(job: PromptStakeJob): Promise<void> {
  if (!env.NOTIFIER_WEBHOOK_URL) {
    throw new Error(`[worker] notifier not configured for prompt stake job ${JSON.stringify(job)}`);
  }

  const res = await fetch(env.NOTIFIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'prompt_stake',
      reviewerLogin: job.reviewerLogin,
      repoSlug: job.repoSlug,
      prId: job.prId,
      minStakeUsdc: job.minStakeUsdc,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    throw new Error(`notifier webhook failed with status ${res.status}`);
  }
}
