import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSummarizerAvailable, summarize } from '@/core/ai/summarizer';

afterEach(() => { delete (globalThis as Record<string, unknown>).Summarizer; });

it('reports unavailable when global is missing', async () => {
  expect(await isSummarizerAvailable()).toBe(false);
  expect(await summarize('x')).toBeNull();
});

it('summarizes when available', async () => {
  (globalThis as Record<string, unknown>).Summarizer = {
    availability: vi.fn().mockResolvedValue('available'),
    create: vi.fn().mockResolvedValue({
      summarize: vi.fn().mockResolvedValue('short summary'),
      destroy: vi.fn(),
    }),
  };
  expect(await isSummarizerAvailable()).toBe(true);
  expect(await summarize('long text')).toBe('short summary');
});

describe('summarize edge cases', () => {
  it('returns null when availability is not "available"', async () => {
    (globalThis as Record<string, unknown>).Summarizer = {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create: vi.fn(),
    };
    expect(await summarize('text')).toBeNull();
  });

  it('returns null and does not throw when summarize() rejects', async () => {
    const destroy = vi.fn();
    (globalThis as Record<string, unknown>).Summarizer = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        summarize: vi.fn().mockRejectedValue(new Error('boom')),
        destroy,
      }),
    };
    expect(await summarize('text')).toBeNull();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
