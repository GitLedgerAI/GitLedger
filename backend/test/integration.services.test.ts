import { describe, expect, test } from 'bun:test';
import { createClient } from 'redis';
import { Pool } from 'pg';

describe('integration services', () => {
  test('postgres and redis are reachable when integration env is enabled', async () => {
    if (process.env.RUN_INTEGRATION !== '1') {
      expect(true).toBe(true);
      return;
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const pg = await pool.query('SELECT 1 as ok');
    expect(pg.rows[0].ok).toBe(1);
    await pool.end();

    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
    await redis.quit();
  });
});
