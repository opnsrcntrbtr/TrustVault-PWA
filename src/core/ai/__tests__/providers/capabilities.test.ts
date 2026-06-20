import { describe, it, expect, afterEach, vi } from 'vitest';
import { hasWebGpu, isAndroid, isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';

const setNav = (patch: Record<string, unknown>) => {
  Object.entries(patch).forEach(([k, v]) => {
    Object.defineProperty(globalThis.navigator, k, { value: v, configurable: true });
  });
};

describe('capabilities', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('hasWebGpu() is false when navigator.gpu is missing', async () => {
    setNav({ gpu: undefined });
    expect(await hasWebGpu()).toBe(false);
  });

  it('hasWebGpu() is true when an adapter is returned', async () => {
    setNav({ gpu: { requestAdapter: vi.fn().mockResolvedValue({}) } });
    expect(await hasWebGpu()).toBe(true);
  });

  it('hasWebGpu() is false when requestAdapter returns null', async () => {
    setNav({ gpu: { requestAdapter: vi.fn().mockResolvedValue(null) } });
    expect(await hasWebGpu()).toBe(false);
  });

  it('isAndroid() detects Android user agents', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/148' });
    expect(isAndroid()).toBe(true);
    setNav({ userAgent: 'Mozilla/5.0 (Macintosh) Chrome/148' });
    expect(isAndroid()).toBe(false);
  });

  it('isMobileAiSurfaceEnabled() mirrors isAndroid() in v1', () => {
    setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    expect(isMobileAiSurfaceEnabled()).toBe(true);
  });
});
