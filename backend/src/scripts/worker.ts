import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
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
    };

    await db.insert(promptStakeJobs).values({
      id: jobId,
      queueName: queue,
      reviewerLogin: payload.reviewerLogin,
      repoSlug: payload.repoSlug,
      prId: payload.prId,
      minStakeUsdc: payload.minStakeUsdc,
      payload,
      status: 'received',
      attempts: 1,
    });

    await processPromptStakeJob(payload);

    await db
      .update(promptStakeJobs)
      .set({
        status: 'processed',
        processedAt: new Date(),
        error: null,
      })
      .where(eq(promptStakeJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db
      .insert(promptStakeJobs)
      .values({
        id: jobId,
        queueName: queue,
        payload: { raw: result.element },
        status: 'failed',
        attempts: 1,
        error: message,
        processedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: promptStakeJobs.id,
        set: {
          status: 'failed',
          error: message,
          processedAt: new Date(),
          attempts: 1,
        },
      });

    console.error('[worker] failed to process prompt-stake job', error, result.element);
  }
}
