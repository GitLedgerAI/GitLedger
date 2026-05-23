import { createClient } from 'redis';
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

  try {
    const payload = JSON.parse(result.element) as {
      reviewerLogin: string;
      repoSlug: string;
      prId: number;
      minStakeUsdc: number;
    };
    await processPromptStakeJob(payload);
  } catch (error) {
    console.error('[worker] failed to process prompt-stake job', error, result.element);
  }
}
