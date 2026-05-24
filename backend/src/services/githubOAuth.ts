import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { db } from '../db/client';
import { reviewers } from '../db/schema';

const API = 'https://github.com/login/oauth';

function signState(payload: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(payload).digest('hex');
}

export function buildOAuthState(wallet: string, callback: string): string {
  const body = JSON.stringify({ wallet: wallet.toLowerCase(), callback, nonce: randomBytes(12).toString('hex') });
  const b64 = Buffer.from(body).toString('base64url');
  const sig = signState(b64);
  return `${b64}.${sig}`;
}

export function parseAndVerifyState(state: string): { wallet: string; callback: string } | null {
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) return null;
  if (signState(b64) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as { wallet: string; callback: string };
    if (!payload.wallet || !payload.callback) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(code: string): Promise<string | null> {
  const res = await fetch(`${API}/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function fetchGithubLogin(token: string): Promise<string | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { login?: string };
  return data.login ?? null;
}

export async function upsertReviewerFromOAuth(wallet: string, githubLogin: string): Promise<void> {
  await db
    .insert(reviewers)
    .values({
      address: wallet.toLowerCase(),
      githubLogin,
      lastActiveAt: new Date(),
    })
    .onConflictDoUpdate({
      target: reviewers.address,
      set: {
        githubLogin,
        lastActiveAt: new Date(),
      },
    });
}
