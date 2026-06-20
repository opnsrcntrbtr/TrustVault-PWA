import { describe, it, expect, afterEach, vi } from 'vitest';
import { getActiveProvider, __resetRegistryForTesting } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';

describe('registry.getActiveProvider', () => {
  afterEach(() => { __resetRegistryForTesting(); vi.restoreAllMocks(); });

  it('selects chrome-builtin when its availability is available', async () => {
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('available');
    const p = await getActiveProvider();
    expect(p?.id).toBe('chrome-builtin');
  });

  it('returns null when chrome unavailable and no WebGPU', async () => {
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: undefined, configurable: true });
    const p = await getActiveProvider();
    expect(p).toBeNull();
  });
});
