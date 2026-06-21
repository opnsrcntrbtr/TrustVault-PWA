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
 * Master kill-switch for the WebLLM (Android) on-device AI surface.
 *
 * DISABLED 2026-06-21 after on-device verification (Task 11). WebLLM inference
 * reliably crashes the Qualcomm Adreno Vulkan driver with VK_ERROR_DEVICE_LOST
 * during engine warm-up — reproduced on two Adreno generations (Adreno 6xx /
 * Android 10 and Adreno 810 / SD 7s Gen 3 / Android 16), both q4f16 AND q4f32,
 * both 0.5B and 1B, with reduced context, on the latest @mlc-ai/web-llm. Plain
 * WebGPU compute works on the same devices, so it is WebLLM's heavy kernels vs.
 * the Adreno driver — not an app bug and not fixable at the app layer. Adreno is
 * the dominant Android GPU and no working Android GPU case is known, so the
 * surface is gated off rather than shipping a multi-hundred-MB download that
 * can't run. Re-enable (flip to `true`) once WebLLM/Dawn/Qualcomm resolve this
 * upstream and inference is re-verified on-device. See TEST_STATUS.md.
 */
const WEBLLM_ANDROID_ENABLED: boolean = false;

/**
 * Kill-switch for the LiteRT-LM (Android) on-device AI surface.
 *
 * ENABLED 2026-06-21 to A/B test whether LiteRT-LM's WebGPU kernels survive
 * the same Qualcomm Adreno devices that crash WebLLM with VK_ERROR_DEVICE_LOST
 * (see TEST_STATUS.md). LiteRT-LM's web target shares the WebGPU/Dawn stack
 * implicated in that failure, so survival is unverified, not assumed — this
 * flag exists to find out on real hardware, independent of WebLLM's flag.
 */
const LITERT_ANDROID_ENABLED: boolean = true;

export function isWebllmEnabled(): boolean { return WEBLLM_ANDROID_ENABLED; }
export function isLitertEnabled(): boolean { return LITERT_ANDROID_ENABLED; }

/**
 * Feature flag: the on-device AI download UI / provider fallback is surfaced
 * only on Android, and only while at least one mobile engine's kill-switch
 * above is enabled. Capability detection (hasWebGpu) stays platform-honest;
 * this only gates the UI + provider selection.
 */
export function isMobileAiSurfaceEnabled(): boolean {
  return (WEBLLM_ANDROID_ENABLED || LITERT_ANDROID_ENABLED) && isAndroid();
}
