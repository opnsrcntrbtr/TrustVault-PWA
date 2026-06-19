import { describe, it, expect, afterEach, vi } from 'vitest';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}

describe('aiAvailability', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
  });

  it('reports unavailable when LanguageModel is absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    expect(await getAiAvailability()).toBe('unavailable');
  });

  it('passes through each availability state', async () => {
    for (const state of ['available', 'downloadable', 'downloading', 'unavailable'] as const) {
      setLanguageModel({ availability: vi.fn().mockResolvedValue(state) });
      expect(await getAiAvailability()).toBe(state);
    }
  });

  it('reports unavailable when availability() throws', async () => {
    setLanguageModel({ availability: vi.fn().mockRejectedValue(new Error('boom')) });
    expect(await getAiAvailability()).toBe('unavailable');
  });

  it('isFeatureUsable is true only for available', () => {
    expect(isFeatureUsable('available')).toBe(true);
    expect(isFeatureUsable('downloadable')).toBe(false);
    expect(isFeatureUsable('downloading')).toBe(false);
    expect(isFeatureUsable('unavailable')).toBe(false);
  });
});
