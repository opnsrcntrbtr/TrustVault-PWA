import { describe, it, expect, vi } from 'vitest';
import { computeVaultSafeAggregate, formatVaultOverviewText, summarizeVaultOverview } from '@/core/ai/chat/vaultAggregate';

vi.mock('@/core/ai/summarizer', () => ({ summarize: vi.fn() }));
import { summarize } from '@/core/ai/summarizer';

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

describe('formatVaultOverviewText', () => {
  const agg = { total: 10, weak: 2, reused: 1, breached: 0, categories: { Login: 10 } };

  it('includes totals and is non-secret', () => {
    const t = formatVaultOverviewText(agg);
    expect(t).toMatch(/Total credentials: 10/);
    expect(() => formatVaultOverviewText(agg)).not.toThrow();
  });
});

describe('summarizeVaultOverview', () => {
  const agg = { total: 10, weak: 2, reused: 1, breached: 0, categories: { Login: 10 } };

  it('uses summarizer when available', async () => {
    vi.mocked(summarize).mockResolvedValue('AI summary');
    expect(await summarizeVaultOverview(agg)).toBe('AI summary');
  });

  it('falls back to formatted text when summarizer returns null', async () => {
    vi.mocked(summarize).mockResolvedValue(null);
    expect(await summarizeVaultOverview(agg)).toBe(formatVaultOverviewText(agg));
  });
});
