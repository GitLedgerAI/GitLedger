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

await runMigrations();

const redisClient = createClient({ url: env.REDIS_URL });
redisClient.on('error', (err) => {
  console.error('[redis] client error', err);
});
await redisClient.connect();

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
  onInstallationCreated: handleInstallationCreated,
  onInstallationDeleted: handleInstallationDeleted,
  onInstallationRepositoriesAdded: handleInstallationRepositoriesAdded,
  onInstallationRepositoriesRemoved: handleInstallationRepositoriesRemoved,
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.info(`GitLedger backend listening on :${env.PORT}`);
