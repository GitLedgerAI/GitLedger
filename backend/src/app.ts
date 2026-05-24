import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { env } from './config/env';
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
import { buildOAuthState, exchangeCodeForToken, fetchGithubLogin, parseAndVerifyState, upsertReviewerFromOAuth } from './services/githubOAuth';
import { isGitHubAppInstalledForUser } from './services/githubApp';

type RedisLike = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, seconds: number) => Promise<unknown>;
};

type AppOptions = {
  githubWebhookSecret: string;
  redis: RedisLike;
  notifierWebhookAuthToken?: string;
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
    reviewerAddress: `0x${string}`;
    reviewerBasename: string;
    repoSlug: string;
    prId: number;
    amountUsdc: number;
  }) => Promise<{ ok: boolean; reason?: string; txHash?: string; onchainStakeId?: string | null; attestationUid?: string | null }>;
  listPromptStakeJobs?: (limit: number, status?: 'received' | 'processed' | 'failed') => Promise<unknown[]>;
  onPromptStakeNotification?: (input: {
    reviewerLogin: string;
    repoSlug: string;
    prId: number;
    minStakeUsdc: number;
    payload: unknown;
  }) => Promise<void>;
};

function requireInternalAuth(authHeader: string | null | undefined): boolean {
  if (!authHeader) return false;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === env.INTERNAL_SERVICE_TOKEN || token === env.ADMIN_API_TOKEN || token === env.INTERNAL_API_TOKEN;
}

const promptStakeNotificationSchema = z.object({
  type: z.literal('prompt_stake'),
  reviewerLogin: z.string().min(1),
  repoSlug: z.string().min(1),
  prId: z.number().int().positive(),
  minStakeUsdc: z.number().int().positive(),
  timestamp: z.string().min(1),
});

export function createApp(options: AppOptions) {
  const app = new Hono();

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'x-wallet-address', 'Authorization'] }));

  // ── tRPC ────────────────────────────────────────────────────────────────────

  app.all('/trpc/*', async (c) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: () => createTRPCContext(c.req.raw),
    });
  });


  app.get('/auth/github', async (c) => {
    const wallet = c.req.query('wallet') ?? '';
    const callback = c.req.query('callback') ?? '';
    if (!callback) return c.json({ error: 'missing_callback' }, 400);

    const state = buildOAuthState(wallet, callback);
    const params = new URLSearchParams({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      redirect_uri: `${new URL(env.GITHUB_WEBHOOK_URL).origin}/auth/github/callback`,
      scope: 'read:user',
      state,
    });
    return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get('/auth/github/callback', async (c) => {
    const code = c.req.query('code') ?? '';
    const state = c.req.query('state') ?? '';
    const parsed = parseAndVerifyState(state);
    if (!code || !parsed) return c.json({ error: 'invalid_oauth_callback' }, 400);

    const token = await exchangeCodeForToken(code);
    if (!token) return c.json({ error: 'oauth_token_exchange_failed' }, 400);

    const githubLogin = await fetchGithubLogin(token);
    if (!githubLogin) return c.json({ error: 'github_user_fetch_failed' }, 400);

    if (parsed.wallet) await upsertReviewerFromOAuth(parsed.wallet, githubLogin);

    const redirectUrl = new URL(parsed.callback);
    if (parsed.wallet) redirectUrl.searchParams.set('wallet', parsed.wallet);
    redirectUrl.searchParams.set('github_login', githubLogin);
    return c.redirect(redirectUrl.toString());
  });

  app.get('/auth/github/install-status', async (c) => {
    const githubLogin = c.req.query('github_login') ?? '';
    if (!githubLogin) return c.json({ error: 'missing_github_login' }, 400);

    try {
      const installed = await isGitHubAppInstalledForUser(githubLogin);
      return c.json({
        ok: true,
        githubLogin,
        installed,
        installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[auth] install-status check failed', { githubLogin, message });
      return c.json({ ok: false, githubLogin, error: 'install_status_check_failed' }, 502);
    }
  });

  app.post('/auth/github/link-wallet', async (c) => {
    let body: { githubLogin?: string; walletAddress?: string };
    try {
      body = (await c.req.json()) as { githubLogin?: string; walletAddress?: string };
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const githubLogin = body.githubLogin?.trim();
    const walletAddress = body.walletAddress?.toLowerCase().trim();
    if (!githubLogin || !walletAddress) return c.json({ error: 'missing_fields' }, 400);
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) return c.json({ error: 'invalid_wallet' }, 400);

    try {
      await upsertReviewerFromOAuth(walletAddress, githubLogin);
      return c.json({ ok: true, githubLogin, walletAddress });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[auth] wallet link failed', { githubLogin, walletAddress, message });
      return c.json({ ok: false, error: 'wallet_link_failed' }, 500);
    }
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

    const body = (await c.req.json()) as {
      stakeId?: string;
      reviewerAddress?: `0x${string}`;
      reviewerBasename?: string;
      repoSlug?: string;
      prId?: number;
      amountUsdc?: number;
    };
    const result = await options.onConfirmStake({
      stakeId: body.stakeId ?? '',
      reviewerAddress: (body.reviewerAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
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
    console.log('[github-webhook] received', { deliveryId, eventName });
    if (!verifyGitHubSignature(signature, rawBody, options.githubWebhookSecret)) {
      console.warn('[github-webhook] invalid signature', { deliveryId, eventName });
      return c.text('unauthorized', 401);
    }

    const dedupKey = `gh:${deliveryId}`;
    const isDup = await options.redis.get(dedupKey);
    if (isDup) {
      console.log('[github-webhook] duplicate delivery ignored', { deliveryId, eventName });
      return c.text('dup', 200);
    }
    await options.redis.set(dedupKey, '1', 30);

    if (eventName === 'pull_request_review') {
      const payload = JSON.parse(rawBody) as GitHubReviewEvent;
      if (isApprovedReviewSubmission(eventName, payload) && options.onApprovedReviewSubmitted) {
        const reviewerLogin = payload.review?.user?.login ?? '';
        const repoSlug = payload.repository?.full_name ?? '';
        const prId = payload.pull_request?.number ?? 0;
        console.log('[github-webhook] approved review detected', { deliveryId, reviewerLogin, repoSlug, prId });
        await options.onApprovedReviewSubmitted({
          reviewerLogin,
          repoSlug,
          prId,
          prTitle: payload.pull_request?.title,
        });
        console.log('[github-webhook] approved review handled', { deliveryId, reviewerLogin, repoSlug, prId });
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

    console.log('[github-webhook] processed', { deliveryId, eventName });
    return c.text('ok', 200);
  });

  app.post('/webhooks/prompt-stake', async (c) => {
    const notifierToken = options.notifierWebhookAuthToken ?? env.NOTIFIER_WEBHOOK_AUTH_TOKEN;
    if (!notifierToken) return c.json({ error: 'not_configured' }, 503);
    const auth = c.req.header('authorization') ?? '';
    const expected = `Bearer ${notifierToken}`;
    if (auth !== expected) return c.json({ error: 'unauthorized' }, 401);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }

    const parsed = promptStakeNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid_payload', details: parsed.error.issues }, 400);
    }

    if (options.onPromptStakeNotification) {
      await options.onPromptStakeNotification({
        reviewerLogin: parsed.data.reviewerLogin,
        repoSlug: parsed.data.repoSlug,
        prId: parsed.data.prId,
        minStakeUsdc: parsed.data.minStakeUsdc,
        payload: body,
      });
    }

    return c.json({ ok: true }, 200);
  });

  return app;
}
