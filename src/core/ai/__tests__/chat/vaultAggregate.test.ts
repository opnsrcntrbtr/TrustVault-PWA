import { describe, it, expect } from 'vitest';
import { computeVaultSafeAggregate } from '@/core/ai/chat/vaultAggregate';

describe('computeVaultSafeAggregate', () => {
  it('counts totals, flags, categories, and oldest age', () => {
    const agg = computeVaultSafeAggregate([
      { category: 'dev', ageDays: 10, isWeak: true, breachCount: 0 },
      { category: 'dev', ageDays: 500, isReused: true, breachCount: 2 },
      { category: 'social', ageDays: 50, breachCount: 0 },
    ]);
    expect(agg.total).toBe(3);
    expect(agg.weak).toBe(1);
    expect(agg.reused).toBe(1);
    expect(agg.breached).toBe(1);
    expect(agg.categories).toEqual({ dev: 2, social: 1 });
    expect(agg.oldestPasswordAgeDays).toBe(500);
  });

  it('handles an empty vault', () => {
    const agg = computeVaultSafeAggregate([]);
    expect(agg).toEqual({ total: 0, weak: 0, reused: 0, breached: 0, categories: {}, oldestPasswordAgeDays: undefined });
  });
});
