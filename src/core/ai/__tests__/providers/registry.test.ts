import { describe, it, expect, afterEach, vi } from 'vitest';
import { getActiveProvider, __resetRegistryForTesting } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';

// Keep real hasWebGpu()/isAndroid() (they read navigator); only make the WebLLM
// surface kill-switch controllable per-test so we can cover both the shipped
// (disabled) state and the re-enabled wiring.
vi.mock('@/core/ai/providers/capabilities', async (orig) => {
  const actual = await orig<typeof import('@/core/ai/providers/capabilities')>();
  return {
    ...actual,
    isMobileAiSurfaceEnabled: vi.fn(actual.isMobileAiSurfaceEnabled),
    isLitertEnabled: vi.fn(actual.isLitertEnabled),
    isWebllmEnabled: vi.fn(actual.isWebllmEnabled),
  };
});

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

  it('returns null on Android + WebGPU while the WebLLM surface kill-switch is off (shipped state)', async () => {
    // isMobileAiSurfaceEnabled is disabled post-Task-11 (systemic Adreno device-loss).
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(false);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    Object.defineProperty(globalThis.navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14)', configurable: true });
    const p = await getActiveProvider();
    expect(p).toBeNull();
  });

  it('selects webllm when chrome is unavailable, WebGPU present, and the surface is enabled (wiring intact for re-enable)', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);
    vi.mocked(isWebllmEnabled).mockReturnValue(true);
    vi.mocked(isLitertEnabled).mockReturnValue(false);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    const p = await getActiveProvider();
    expect(p?.id).toBe('webllm');
  });

  it('selects litert-lm by default when chrome unavailable, WebGPU present, surface enabled, and LiteRT is the engine choice', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);
    vi.mocked(isLitertEnabled).mockReturnValue(true);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    vi.doMock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => ({ mobileInferenceEngine: 'litert-lm' }) }));
    const { getActiveProvider: getActiveProviderFresh } = await import('@/core/ai/providers/registry');
    const p = await getActiveProviderFresh();
    expect(p?.id).toBe('litert-lm');
  });

  it('falls back to webllm when litert-lm is chosen but disabled, and webllm is enabled', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);
    vi.mocked(isLitertEnabled).mockReturnValue(false);
    vi.mocked(isWebllmEnabled).mockReturnValue(true);
    vi.spyOn(chromeBuiltinProvider, 'getAvailability').mockResolvedValue('unavailable');
    Object.defineProperty(globalThis.navigator, 'gpu', { value: { requestAdapter: vi.fn().mockResolvedValue({}) }, configurable: true });
    vi.doMock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => ({ mobileInferenceEngine: 'litert-lm' }) }));
    const { getActiveProvider: getActiveProviderFresh } = await import('@/core/ai/providers/registry');
    const p = await getActiveProviderFresh();
    expect(p?.id).toBe('webllm');
  });
});
