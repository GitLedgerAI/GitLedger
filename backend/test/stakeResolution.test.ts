import { describe, expect, test } from 'bun:test';
import { activatePendingStake } from '../src/services/stakeResolution';

describe('activatePendingStake', () => {
  test('returns pending_stake_not_found when missing', async () => {
    const result = await activatePendingStake(
      {
        stakeId: 'pending:org/repo:1:alice',
        txHashStake: '0xabc',
        attestationUid: '0xuid',
      },
      {
        findPendingStakeByStakeId: async () => null,
        activateStake: async () => {},
      },
    );

    expect(result).toEqual({ ok: false, reason: 'pending_stake_not_found' });
  });

  test('activates pending stake with tx hash and attestation uid', async () => {
    let updated: Record<string, unknown> | null = null;

    const result = await activatePendingStake(
      {
        stakeId: 'pending:gitledger/repo:77:bob',
        txHashStake: '0xstakehash',
        attestationUid: '0xattuid',
      },
      {
        findPendingStakeByStakeId: async () => ({
          id: 'stake-row-1',
          amountUsdc: 12000000,
          stakedAt: null,
        }),
        activateStake: async (params) => {
          updated = params as unknown as Record<string, unknown>;
        },
      },
    );

    expect(result).toEqual({ ok: true });
    expect(updated?.stakeId).toBe('pending:gitledger/repo:77:bob');
    expect(updated?.txHashStake).toBe('0xstakehash');
    expect(updated?.attestationUid).toBe('0xattuid');
    expect(updated?.amountUsdc).toBe(12000000);
    expect(updated?.windowEndsAt).toBeInstanceOf(Date);
  });
});
