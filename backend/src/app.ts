import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import { env } from './config/env';
import { db } from './db/client';
import { reviewers, stakes } from './db/schema';
import { appRouter } from './routes/trpc';
import { createTRPCContext } from './trpc/context';
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
  onApprovedReviewSubmitted?: (input: {
    reviewerLogin: string;
    repoSlug: string;
    prId: number;
    prTitle?: string;
  }) => Promise<unknown>;
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
  onActivatePendingStake?: (input: {
    stakeId: string;
    txHashStake: string;
    attestationUid: string;
    amountUsdc?: number;
  }) => Promise<{ ok: boolean; reason?: string }>;
  onConfirmStake?: (input: {
    stakeId: string;
    reviewerBasename: string;
    repoSlug: string;
    prId: number;
    amountUsdc: number;
  }) => Promise<{ ok: boolean; reason?: string; txHash?: string; onchainStakeId?: string | null; attestationUid?: string | null }>;
  listPromptStakeJobs?: (limit: number, status?: 'received' | 'processed' | 'failed') => Promise<unknown[]>;
};

function requireInternalAuth(authHeader: string | null | undefined): boolean {
  if (!authHeader) return false;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === env.INTERNAL_SERVICE_TOKEN || token === env.ADMIN_API_TOKEN || token === env.INTERNAL_API_TOKEN;
}

export function createApp(options: AppOptions) {
  const app = new Hono();

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'x-wallet-address', 'Authorization'] }));

  // ── GitHub OAuth ────────────────────────────────────────────────────────────

  app.get('/auth/github', (c) => {
    const reqUrl = new URL(c.req.url);
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
    const callback = c.req.query('callback') ?? '';
    const wallet   = c.req.query('wallet') ?? '';
    const state    = Buffer.from(JSON.stringify({ callback, wallet })).toString('base64url');
    const redirectUri = encodeURIComponent(`${baseUrl}/auth/callback`);
    const ghUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_APP_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=read:user`;
    return c.redirect(ghUrl);
  });

  app.get('/auth/callback', async (c) => {
    const code     = c.req.query('code') ?? '';
    const stateRaw = c.req.query('state') ?? '';

    let callback = '';
    let wallet   = '';
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString()) as { callback?: string; wallet?: string };
      callback = parsed.callback ?? '';
      wallet   = parsed.wallet   ?? '';
    } catch { /* malformed state — proceed without callback/wallet */ }

    // Exchange code → access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'GitLedgerAI' },
      body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      const err = encodeURIComponent(tokenData.error ?? 'oauth_failed');
      return callback ? c.redirect(`${callback}?error=${err}`) : c.text('OAuth failed', 400);
    }

    // Get GitHub user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'GitLedgerAI' },
    });
    const user = await userRes.json() as { login?: string };
    const login = user.login ?? '';
    if (!login) {
      return callback ? c.redirect(`${callback}?error=no_github_login`) : c.text('No GitHub login', 400);
    }

    const placeholderAddr = `github:${login}`;
    const realAddr = wallet ? wallet.toLowerCase() : placeholderAddr;

    // Upsert reviewer; if wallet provided, migrate placeholder address → real wallet
    const existing = await db.query.reviewers.findFirst({ where: eq(reviewers.githubLogin, login) });
    if (wallet && existing && existing.address === placeholderAddr) {
      await db.update(reviewers).set({ address: realAddr, lastActiveAt: new Date() }).where(eq(reviewers.address, placeholderAddr));
      await db.update(stakes).set({ reviewerAddr: realAddr }).where(eq(stakes.reviewerAddr, placeholderAddr));
    } else {
      await db.insert(reviewers)
        .values({ address: realAddr, githubLogin: login, lastActiveAt: new Date() })
        .onConflictDoUpdate({ target: reviewers.address, set: { githubLogin: login, lastActiveAt: new Date() } });
    }

    const reviewer = await db.query.reviewers.findFirst({ where: eq(reviewers.githubLogin, login) });
    const basename = reviewer?.basename ?? null;

    if (!callback) return c.json({ ok: true, githubLogin: login, basename, wallet: realAddr });

    const params = new URLSearchParams({ githubLogin: login });
    if (basename) params.set('basename', basename);
    if (wallet)   params.set('wallet', wallet);
    return c.redirect(`${callback}?${params.toString()}`);
  });

  // ── tRPC ────────────────────────────────────────────────────────────────────

  app.all('/trpc/*', async (c) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: () => createTRPCContext(c.req.raw),
    });
  });

  app.get('/health', async (c) => {
    if (!options.healthCheck) return c.json({ ok: true, service: 'gitledger-backend' });
    const report = await options.healthCheck();
    return c.json(report, report.ok ? 200 : 503);
  });

  app.get('/internal/prompt-stake-jobs', async (c) => {
    if (!options.listPromptStakeJobs) return c.json({ error: 'not_configured' }, 503);
    if (!requireInternalAuth(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401);

    const limitRaw = c.req.query('limit');
    const limit = Math.min(Math.max(Number(limitRaw ?? '25') || 25, 1), 100);
    const statusRaw = c.req.query('status');
    const status = statusRaw === 'received' || statusRaw === 'processed' || statusRaw === 'failed' ? statusRaw : undefined;

    const jobs = await options.listPromptStakeJobs(limit, status);
    return c.json({ ok: true, count: jobs.length, jobs });
  });

  app.post('/internal/stakes/activate', async (c) => {
    if (!options.onActivatePendingStake) return c.json({ error: 'not_configured' }, 503);
    if (!requireInternalAuth(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401);

    const body = (await c.req.json()) as { stakeId?: string; txHashStake?: string; attestationUid?: string; amountUsdc?: number };
    const result = await options.onActivatePendingStake({
      stakeId: body.stakeId ?? '',
      txHashStake: body.txHashStake ?? '',
      attestationUid: body.attestationUid ?? '',
      amountUsdc: body.amountUsdc,
    });

    if (!result.ok) return c.json(result, 400);
    return c.json(result, 200);
  });

  app.post('/internal/stakes/confirm', async (c) => {
    if (!options.onConfirmStake) return c.json({ error: 'not_configured' }, 503);
    if (!requireInternalAuth(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401);

    const body = (await c.req.json()) as { stakeId?: string; reviewerBasename?: string; repoSlug?: string; prId?: number; amountUsdc?: number };
    const result = await options.onConfirmStake({
      stakeId: body.stakeId ?? '',
      reviewerBasename: body.reviewerBasename ?? '',
      repoSlug: body.repoSlug ?? '',
      prId: body.prId ?? 0,
      amountUsdc: body.amountUsdc ?? 0,
    });

    if (!result.ok) return c.json(result, 400);
    return c.json(result, 200);
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
      if (isApprovedReviewSubmission(eventName, payload) && options.onApprovedReviewSubmitted) {
        await options.onApprovedReviewSubmitted({
          reviewerLogin: payload.review?.user?.login ?? '',
          repoSlug: payload.repository?.full_name ?? '',
          prId: payload.pull_request?.number ?? 0,
          prTitle: payload.pull_request?.title,
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
