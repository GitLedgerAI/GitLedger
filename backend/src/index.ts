import { createClient } from 'redis';
import { createApp } from './app';
import { env } from './config/env';
import { pgPool } from './db/client';
import { runMigrations } from './db/migrate';
import {
  handleInstallationCreated,
  handleInstallationDeleted,
  handleInstallationRepositoriesAdded,
  handleInstallationRepositoriesRemoved,
} from './services/githubWebhookHandlers';
import { getHealthReport } from './services/health';
import { listPromptStakeJobs } from './services/internalJobs';
import { configurePromptStakeQueue, setPromptStakePublisher } from './services/queue';
import { handleApprovedReviewSubmitted } from './services/reviewWebhookHandlers';
import { activatePendingStake } from './services/stakeResolution';
import { confirmStakeOnchainAndActivate } from './services/stakeConfirmation';

await runMigrations();

const redisClient = createClient({ url: env.REDIS_URL });
redisClient.on('error', (err) => {
  console.error('[redis] client error', err);
});
await redisClient.connect();

configurePromptStakeQueue(env.PROMPT_STAKE_QUEUE_NAME);
setPromptStakePublisher(async (queueName, payload) => {
  await redisClient.lPush(queueName, payload);
});

const healthCheck = () =>
  getHealthReport({
    pgPool,
    redisPing: () => redisClient.ping(),
    githubToken: env.GITHUB_TOKEN,
    baseRpcUrl: env.BASE_RPC_URL,
  });

const startupHealth = await healthCheck();
console.info('[startup] service health', JSON.stringify(startupHealth));

const app = createApp({
  githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET,
  redis: {
    get: (key: string) => redisClient.get(key),
    set: (key: string, value: string, seconds: number) => redisClient.set(key, value, { EX: seconds }),
  },
  healthCheck,
  onApprovedReviewSubmitted: handleApprovedReviewSubmitted,
  onInstallationCreated: handleInstallationCreated,
  onInstallationDeleted: handleInstallationDeleted,
  onInstallationRepositoriesAdded: handleInstallationRepositoriesAdded,
  onInstallationRepositoriesRemoved: handleInstallationRepositoriesRemoved,
  onActivatePendingStake: activatePendingStake,
  onConfirmStake: confirmStakeOnchainAndActivate,
  listPromptStakeJobs,
  onPromptStakeNotification: async (input) => {
    console.info('[notifier] prompt-stake webhook received', {
      reviewerLogin: input.reviewerLogin,
      repoSlug: input.repoSlug,
      prId: input.prId,
      minStakeUsdc: input.minStakeUsdc,
    });
  },
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.info(`GitLedger backend listening on :${env.PORT}`);
