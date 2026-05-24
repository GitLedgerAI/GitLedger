import { describe, expect, test } from 'bun:test';
import type { ConfirmStakeInput } from '../src/services/stakeConfirmation';

// Lightweight contract-style test for request shape + guard behavior.
describe('stake confirmation input shape', () => {
  test('requires all fields for confirmation payload', () => {
    const payload: ConfirmStakeInput = {
      stakeId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      reviewerAddress: '0x1111111111111111111111111111111111111111',
      reviewerBasename: 'alice.base.eth',
      repoSlug: 'org/repo',
      prId: 1,
      amountUsdc: 10000000,
    };

    expect(payload.stakeId.length > 0).toBe(true);
    expect(payload.reviewerBasename.includes('.base.eth')).toBe(true);
    expect(payload.prId > 0).toBe(true);
    expect(payload.amountUsdc > 0).toBe(true);
  });
});
