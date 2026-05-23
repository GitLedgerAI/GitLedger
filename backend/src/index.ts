import Redis from 'ioredis';
import { env } from './config/env';
import { createApp } from './app';

const redis = new Redis(env.REDIS_URL);
const app = createApp({ githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET, redis });

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.info(`GitLedger backend listening on :${env.PORT}`);
