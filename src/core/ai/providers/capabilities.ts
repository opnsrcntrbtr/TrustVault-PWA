/**
 * Platform/hardware capability probes for on-device AI provider selection.
 * WebGPU detection is the real gate; isAndroid()/surface flag scope the v1 UI.
 */

/** True only if a WebGPU adapter can actually be acquired. */
export async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu || typeof gpu.requestAdapter !== 'function') return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter != null;
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * v1 feature flag: the WebLLM download UI is surfaced only on Android.
 * Capability detection (hasWebGpu) stays platform-honest; this only gates UI.
 */
export function isMobileAiSurfaceEnabled(): boolean {
  return isAndroid();
}
