import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createApp } from '../src/app';
import { resetEnqueuePromptStakeForTests, setEnqueuePromptStakeForTests } from '../src/services/queue';

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

function signedHeaders(body: string, secret: string, delivery = 'd1') {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return {
    'content-type': 'application/json',
    'x-hub-signature-256': `sha256=${sig}`,
    'x-github-event': 'pull_request_review',
    'x-github-delivery': delivery,
  };
}

describe('createApp webhook flow', () => {
  const secret = 'webhook_secret';

  beforeEach(() => {
    resetEnqueuePromptStakeForTests();
  });

  afterEach(() => {
    resetEnqueuePromptStakeForTests();
  });

  test('returns 401 for invalid signature', async () => {
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

  test('deduplicates by delivery id', async () => {
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

  test('queues stake prompt for approved review', async () => {
    const jobs: Array<Record<string, unknown>> = [];
    setEnqueuePromptStakeForTests(async (job) => {
      jobs.push(job as unknown as Record<string, unknown>);
    });

    const app = createApp({ githubWebhookSecret: secret, redis: createRedisMock(), minStakeUsdc: 12_000_000 });
    const body = JSON.stringify({
      action: 'submitted',
      review: { state: 'approved', user: { login: 'bob' } },
      repository: { full_name: 'gitledger/repo' },
      pull_request: { number: 77 },
    });

    const res = await app.request('/webhooks/github', {
      method: 'POST',
      headers: signedHeaders(body, secret, 'delivery-2'),
      body,
    });

    expect(res.status).toBe(200);
    expect(jobs.length).toBe(1);
    expect(jobs[0]).toEqual({
      reviewerLogin: 'bob',
      repoSlug: 'gitledger/repo',
      prId: 77,
      minStakeUsdc: 12_000_000,
    });
  });
});
