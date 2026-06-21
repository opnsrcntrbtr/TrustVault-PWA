/**
 * Shared WebGPU device-loss detection, used by every browser-based AiProvider
 * (WebLLM, LiteRT-LM). A device-loss failure cascades once the GPU device is
 * gone, so callers normalize it into one clean error instead of letting the
 * underlying library's internal rejections flood the console.
 */

/** User-facing message when the GPU can't sustain on-device inference. */
export const DEVICE_UNAVAILABLE_MESSAGE =
  "On-device AI could not start on this device's GPU. It may not support running this model.";

/** True for WebGPU device-loss / dropped-instance failures. */
export function isDeviceLostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /device was lost|external instance reference|poperrorscope|gpudevice|device is lost/i.test(msg);
}
