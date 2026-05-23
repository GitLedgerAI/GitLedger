import { Hono } from 'hono';
import { enqueuePromptStake } from './services/queue';
import {
  isApprovedReviewSubmission,
  isInstallationCreated,
  isInstallationDeleted,
  isInstallationRepositoriesEvent,
  type GitHubInstallationEvent,
  type GitHubInstallationRepositoriesEvent,
  type GitHubReviewEvent,
  verifyGitHubSignature,
} from './services/githubWebhook';
import type { HealthReport } from './services/health';

type RedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, seconds: number) => Promise<unknown>;
};

type AppOptions = {
  githubWebhookSecret: string;
  redis: RedisLike;
  minStakeUsdc?: number;
  healthCheck?: () => Promise<HealthReport>;
  onInstallationCreated?: (installationId: number) => Promise<void>;
  onInstallationDeleted?: (installationId: number) => Promise<void>;
  onInstallationRepositoriesAdded?: (
    installationId: number,
    repositoriesAdded: Array<{ full_name?: string }>,
  ) => Promise<void>;
  onInstallationRepositoriesRemoved?: (
    installationId: number,
    repositoriesRemoved: Array<{ full_name?: string }>,
  ) => Promise<void>;
};

export function createApp(options: AppOptions) {
  const app = new Hono();
  const minStakeUsdc = options.minStakeUsdc ?? 10_000_000;

  app.get('/health', async (c) => {
    if (!options.healthCheck) return c.json({ ok: true, service: 'gitledger-backend' });
    const report = await options.healthCheck();
    return c.json(report, report.ok ? 200 : 503);
  });

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
    await options.redis.set(dedupKey, '1', 30);

    if (eventName === 'pull_request_review') {
      const payload = JSON.parse(rawBody) as GitHubReviewEvent;
      if (isApprovedReviewSubmission(eventName, payload)) {
        await enqueuePromptStake({
          reviewerLogin: payload.review?.user?.login ?? '',
          repoSlug: payload.repository?.full_name ?? '',
          prId: payload.pull_request?.number ?? 0,
          minStakeUsdc,
        });
      }
    }

    if (eventName === 'installation') {
      const payload = JSON.parse(rawBody) as GitHubInstallationEvent;
      if (isInstallationCreated(eventName, payload) && options.onInstallationCreated) {
        await options.onInstallationCreated(payload.installation!.id!);
      }
      if (isInstallationDeleted(eventName, payload) && options.onInstallationDeleted) {
        await options.onInstallationDeleted(payload.installation!.id!);
      }
    }

    if (eventName === 'installation_repositories') {
      const payload = JSON.parse(rawBody) as GitHubInstallationRepositoriesEvent;
      if (isInstallationRepositoriesEvent(eventName, payload)) {
        if (payload.action === 'added' && options.onInstallationRepositoriesAdded) {
          await options.onInstallationRepositoriesAdded(payload.installation!.id!, payload.repositories_added ?? []);
        }
        if (payload.action === 'removed' && options.onInstallationRepositoriesRemoved) {
          await options.onInstallationRepositoriesRemoved(payload.installation!.id!, payload.repositories_removed ?? []);
        }
      }
    }

    return c.text('ok', 200);
  });

  return app;
}
