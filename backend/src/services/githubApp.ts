import { createSign } from 'node:crypto';
import { env } from '../config/env';

type InstallationAccessTokenResponse = {
  token: string;
  expires_at: string;
  permissions?: Record<string, string>;
  repositories?: Array<{ id: number; full_name: string }>;
};

function normalizePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export function createGitHubAppJwt(nowMs = Date.now()): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(nowMs / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: env.GITHUB_APP_ID,
  };

  const base64Url = (input: string) => Buffer.from(input).toString('base64url');
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(env.GITHUB_APP_PRIVATE_KEY)).toString('base64url');
  return `${signingInput}.${signature}`;
}

export async function getInstallationAccessToken(installationId: number): Promise<InstallationAccessTokenResponse> {
  const jwt = createGitHubAppJwt();

  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitLedgerAI',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to create installation token (${res.status}): ${body}`);
  }

  return (await res.json()) as InstallationAccessTokenResponse;
}

export async function getInstallationRepositories(installationId: number): Promise<Array<{ id: number; full_name: string }>> {
  const token = await getInstallationAccessToken(installationId);

  const res = await fetch('https://api.github.com/installation/repositories', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitLedgerAI',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`failed to list installation repositories (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { repositories?: Array<{ id: number; full_name: string }> };
  return data.repositories ?? [];
}

export async function isGitHubAppInstalledForUser(githubLogin: string): Promise<boolean> {
  const jwt = createGitHubAppJwt();
  const encodedLogin = encodeURIComponent(githubLogin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/users/${encodedLogin}/installation`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'GitLedgerAI',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 404) return false;
  if (res.ok) return true;

  const body = await res.text();
  throw new Error(`failed to check user installation (${res.status}): ${body}`);
}
