import type { Pool } from 'pg';

type RedisPing = () => Promise<string>;

type HealthStatus = 'up' | 'down';

export type ServiceHealth = {
  status: HealthStatus;
  details?: string;
};

export type HealthReport = {
  ok: boolean;
  service: string;
  timestamp: string;
  services: {
    postgres: ServiceHealth;
    redis: ServiceHealth;
    github: ServiceHealth;
    baseRpc: ServiceHealth;
  };
};

export type HealthDeps = {
  pgPool: Pool;
  redisPing: RedisPing;
  githubToken: string;
  baseRpcUrl: string;
};

async function checkPostgres(pgPool: Pool): Promise<ServiceHealth> {
  try {
    await pgPool.query('SELECT 1');
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', details: String(error) };
  }
}

async function checkRedis(redisPing: RedisPing): Promise<ServiceHealth> {
  try {
    const pong = await redisPing();
    return pong.toUpperCase() === 'PONG' ? { status: 'up' } : { status: 'down', details: `unexpected ping response: ${pong}` };
  } catch (error) {
    return { status: 'down', details: String(error) };
  }
}

async function checkGitHub(githubToken: string): Promise<ServiceHealth> {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) return { status: 'down', details: `status ${res.status}` };
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', details: String(error) };
  }
}

async function checkBaseRpc(baseRpcUrl: string): Promise<ServiceHealth> {
  try {
    const res = await fetch(baseRpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    if (!res.ok) return { status: 'down', details: `status ${res.status}` };
    return { status: 'up' };
  } catch (error) {
    return { status: 'down', details: String(error) };
  }
}

export async function getHealthReport(deps: HealthDeps): Promise<HealthReport> {
  const [postgres, redis, github, baseRpc] = await Promise.all([
    checkPostgres(deps.pgPool),
    checkRedis(deps.redisPing),
    checkGitHub(deps.githubToken),
    checkBaseRpc(deps.baseRpcUrl),
  ]);

  const ok = [postgres, redis, github, baseRpc].every((s) => s.status === 'up');

  return {
    ok,
    service: 'gitledger-backend',
    timestamp: new Date().toISOString(),
    services: { postgres, redis, github, baseRpc },
  };
}
