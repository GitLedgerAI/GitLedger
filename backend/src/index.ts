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
import { handleMergedPullRequest } from './services/hotfixWebhookHandlers';
import { resolveDueStakes } from './services/oracleResolver';
import { activatePendingStake } from './services/stakeResolution';

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
  onMergedPullRequest: async (input) => {
    const result = await handleMergedPullRequest(input);
    console.info('[hotfix] merged pr processed', {
      repoSlug: input.repoSlug,
      prId: input.prId,
      considered: result.considered,
      reason: result.reason,
      slashed: result.slashed,
    });
  },
  onInstallationCreated: handleInstallationCreated,
  onInstallationDeleted: handleInstallationDeleted,
  onInstallationRepositoriesAdded: handleInstallationRepositoriesAdded,
  onInstallationRepositoriesRemoved: handleInstallationRepositoriesRemoved,
  onActivatePendingStake: activatePendingStake,
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

// ── Background oracle resolver ──────────────────────────────────────────────
// Periodically scan for stakes whose 30-day window has elapsed and resolve
// them onchain (slash if hotfix detected, else release yield). Set the
// interval via env ORACLE_POLL_INTERVAL_SECONDS (default 86400 = once/day).
const oracleIntervalMs = env.ORACLE_POLL_INTERVAL_SECONDS * 1000;
console.info(`[oracle-scheduler] starting; interval=${env.ORACLE_POLL_INTERVAL_SECONDS}s`);
let oracleTickRunning = false;
const oracleTick = async () => {
  if (oracleTickRunning) {
    console.warn('[oracle-scheduler] previous tick still running; skipping');
    return;
  }
  oracleTickRunning = true;
  try {
    await resolveDueStakes();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[oracle-scheduler] tick crashed', { error: message });
  } finally {
    oracleTickRunning = false;
  }
};
// Fire once on boot so a freshly-started backend doesn't sit idle for a full
// interval before catching up on overdue stakes.
void oracleTick();
setInterval(oracleTick, oracleIntervalMs);

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.info(`GitLedger backend listening on :${env.PORT}`);
