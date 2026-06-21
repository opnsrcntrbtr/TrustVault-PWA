import { describe, it, expect } from 'vitest';
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';

describe('gpuErrors', () => {
  it('recognizes a WebGPU device-lost message', () => {
    expect(isDeviceLostError(new Error('Device was lost. This can happen due to insufficient memory.'))).toBe(true);
  });
  it('recognizes a dropped-instance message', () => {
    expect(isDeviceLostError(new Error('A valid external Instance reference no longer exists.'))).toBe(true);
  });
  it('recognizes a non-Error thrown value', () => {
    expect(isDeviceLostError('GPUDevice is lost')).toBe(true);
  });
  it('returns false for unrelated errors', () => {
    expect(isDeviceLostError(new Error('network timeout'))).toBe(false);
  });
  it('exposes a stable user-facing message', () => {
    expect(DEVICE_UNAVAILABLE_MESSAGE).toMatch(/on-device AI could not start/i);
  });
});
