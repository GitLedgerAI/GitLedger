import { Hono } from 'hono';
import { enqueuePromptStake } from './services/queue';
import { isApprovedReviewSubmission, verifyGitHubSignature, type GitHubReviewEvent } from './services/githubWebhook';

type RedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: 'EX', seconds: number) => Promise<unknown>;
};

type AppOptions = {
  githubWebhookSecret: string;
  redis: RedisLike;
  minStakeUsdc?: number;
};

export function createApp(options: AppOptions) {
  const app = new Hono();
  const minStakeUsdc = options.minStakeUsdc ?? 10_000_000;

  app.get('/health', (c) => c.json({ ok: true, service: 'gitledger-backend' }));

  app.post('/webhooks/github', async (c) => {
    const signature = c.req.header('x-hub-signature-256') ?? null;
    const eventName = c.req.header('x-github-event') ?? null;
    const deliveryId = c.req.header('x-github-delivery') ?? 'unknown';

    const rawBody = await c.req.text();
    if (!verifyGitHubSignature(signature, rawBody, options.githubWebhookSecret)) {
      return c.text('unauthorized', 401);
    }

    const dedupKey = `gh:${deliveryId}`;
    const isDup = await options.redis.get(dedupKey);
    if (isDup) return c.text('dup', 200);
    await options.redis.set(dedupKey, '1', 'EX', 30);

    const payload = JSON.parse(rawBody) as GitHubReviewEvent;
    if (isApprovedReviewSubmission(eventName, payload)) {
      await enqueuePromptStake({
        reviewerLogin: payload.review?.user?.login ?? '',
        repoSlug: payload.repository?.full_name ?? '',
        prId: payload.pull_request?.number ?? 0,
        minStakeUsdc,
      });
    }

    return c.text('ok', 200);
  });

  return app;
}
