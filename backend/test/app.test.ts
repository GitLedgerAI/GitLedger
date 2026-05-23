import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app';
import { env } from '../src/config/env';

type Store = Record<string, string>;

function createRedisMock() {
  const store: Store = {};
  return {
    get: async (key: string) => store[key] ?? null,
    set: async (key: string, value: string) => {
      store[key] = value;
      return 'OK';
    },
  };
}

function signedHeaders(body: string, secret: string, delivery = 'd1', event = 'pull_request_review') {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return {
    'content-type': 'application/json',
    'x-hub-signature-256': `sha256=${sig}`,
    'x-github-event': event,
    'x-github-delivery': delivery,
  };
}

describe('createApp routes', () => {
  const secret = 'webhook_secret';

  test('health endpoint returns injected health report', async () => {
    const app = createApp({
      githubWebhookSecret: secret,
      redis: createRedisMock(),
      healthCheck: async () => ({
        ok: true,
        service: 'gitledger-backend',
        timestamp: new Date().toISOString(),
        services: {
          postgres: { status: 'up' },
          redis: { status: 'up' },
          github: { status: 'up' },
          baseRpc: { status: 'up' },
        },
      }),
    });

    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  test('internal stake activation endpoint rejects missing auth', async () => {
    const app = createApp({
      githubWebhookSecret: secret,
      redis: createRedisMock(),
      internalApiToken: 'token-1',
      onActivatePendingStake: async () => ({ ok: true }),
    });

    const res = await app.request('/internal/stakes/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stakeId: 's1', txHashStake: '0x1', attestationUid: '0x2' }),
    });

    expect(res.status).toBe(401);
  });

  test('internal stake activation endpoint accepts valid auth', async () => {
    const app = createApp({
      githubWebhookSecret: secret,
      redis: createRedisMock(),
      internalApiToken: 'token-1',
      onActivatePendingStake: async () => ({ ok: true }),
    });

    const res = await app.request('/internal/stakes/activate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ stakeId: 's1', txHashStake: '0x1', attestationUid: '0x2' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  test('returns 401 for invalid webhook signature', async () => {
    const app = createApp({ githubWebhookSecret: secret, redis: createRedisMock() });
    const body = JSON.stringify({ action: 'submitted' });

    const res = await app.request('/webhooks/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=bad',
      },
      body,
    });

    expect(res.status).toBe(401);
  });

  test('deduplicates webhook deliveries', async () => {
    const app = createApp({ githubWebhookSecret: secret, redis: createRedisMock() });
    const body = JSON.stringify({
      action: 'submitted',
      review: { state: 'approved', user: { login: 'alice' } },
      repository: { full_name: 'org/repo' },
      pull_request: { number: 10 },
    });

    const headers = signedHeaders(body, secret, 'delivery-1');
    const first = await app.request('/webhooks/github', { method: 'POST', headers, body });
    const second = await app.request('/webhooks/github', { method: 'POST', headers, body });

    expect(first.status).toBe(200);
    expect(await first.text()).toBe('ok');
    expect(second.status).toBe(200);
    expect(await second.text()).toBe('dup');
  });

  test('calls approved review handler when review is approved', async () => {
    let called = false;

    const app = createApp({
      githubWebhookSecret: secret,
      redis: createRedisMock(),
      onApprovedReviewSubmitted: async () => {
        called = true;
      },
    });

    const body = JSON.stringify({
      action: 'submitted',
      review: { state: 'approved', user: { login: 'bob' } },
      repository: { full_name: 'gitledger/repo' },
      pull_request: { number: 77, title: 'Fix parser' },
    });

    const res = await app.request('/webhooks/github', {
      method: 'POST',
      headers: signedHeaders(body, secret, 'delivery-2'),
      body,
    });

    expect(res.status).toBe(200);
    expect(called).toBe(true);
  });
});
