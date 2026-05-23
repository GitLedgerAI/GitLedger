import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createClient } from 'redis';
import { db } from '../db/client';
import { promptStakeJobs } from '../db/schema';
import { env } from '../config/env';
import { getPromptStakeQueueName } from '../services/queue';
import { processPromptStakeJob } from '../services/promptStakeWorker';

const redis = createClient({ url: env.REDIS_URL });
redis.on('error', (err) => {
  console.error('[worker] redis error', err);
});

await redis.connect();
console.info('[worker] connected to redis');

const queue = getPromptStakeQueueName();
const dlq = env.PROMPT_STAKE_DLQ_NAME;
console.info(`[worker] listening on queue: ${queue}`);

while (true) {
  const result = await redis.brPop(queue, 0);
  if (!result) continue;

  const jobId = randomUUID();

  try {
    const payload = JSON.parse(result.element) as {
      reviewerLogin: string;
      repoSlug: string;
      prId: number;
      minStakeUsdc: number;
      attempts?: number;
    };

    const attempts = payload.attempts ?? 1;

    await db.insert(promptStakeJobs).values({
      id: jobId,
      queueName: queue,
      reviewerLogin: payload.reviewerLogin,
      repoSlug: payload.repoSlug,
      prId: payload.prId,
      minStakeUsdc: payload.minStakeUsdc,
      payload,
      status: 'received',
      attempts,
    });

    await processPromptStakeJob(payload);

    await db.update(promptStakeJobs).set({ status: 'processed', processedAt: new Date(), error: null }).where(eq(promptStakeJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    let parsed: { attempts?: number } = {};
    try {
      parsed = JSON.parse(result.element) as { attempts?: number };
    } catch {
      parsed = {};
    }

    const attempts = (parsed.attempts ?? 1) + 1;

    await db
      .insert(promptStakeJobs)
      .values({
        id: jobId,
        queueName: queue,
        payload: { raw: result.element, attempts },
        status: attempts > env.PROMPT_STAKE_MAX_ATTEMPTS ? 'failed' : 'received',
        attempts,
        error: message,
        processedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: promptStakeJobs.id,
        set: {
          status: attempts > env.PROMPT_STAKE_MAX_ATTEMPTS ? 'failed' : 'received',
          error: message,
          processedAt: new Date(),
          attempts,
        },
      });

    if (attempts > env.PROMPT_STAKE_MAX_ATTEMPTS) {
      await redis.lPush(dlq, JSON.stringify({ raw: result.element, error: message, attempts, failedAt: new Date().toISOString() }));
      console.error('[worker] moved job to DLQ', { dlq, attempts, error: message });
    } else {
      let retryPayload: Record<string, unknown> = {};
      try {
        retryPayload = JSON.parse(result.element) as Record<string, unknown>;
      } catch {
        retryPayload = { raw: result.element };
      }
      retryPayload.attempts = attempts;
      await redis.lPush(queue, JSON.stringify(retryPayload));
      console.warn('[worker] requeued prompt-stake job', { attempts });
    }
  }
}
