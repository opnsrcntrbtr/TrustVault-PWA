/**
 * Platform runtime seam tests.
 *
 * Single source of truth for "are we running inside the native Capacitor app".
 * Used to (a) select the native OCR provider and (b) disable the WebAuthn/PRF
 * biometric path on the native Android surface, where PRF does not survive the
 * WebView → Credential Manager round-trip (see
 * docs/OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { isNativePlatformMock, getPlatformMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
  getPlatformMock: vi.fn(() => 'web'),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: isNativePlatformMock,
    getPlatform: getPlatformMock,
  },
}));

import { isNativeApp, isNativeAndroidApp } from '@/core/platform/runtime';

describe('platform/runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativePlatformMock.mockReturnValue(false);
    getPlatformMock.mockReturnValue('web');
  });

  describe('isNativeApp()', () => {
    it('is false on the web', () => {
      expect(isNativeApp()).toBe(false);
    });

    it('is true inside the native Capacitor shell (any platform)', () => {
      isNativePlatformMock.mockReturnValue(true);
      getPlatformMock.mockReturnValue('android');
      expect(isNativeApp()).toBe(true);
    });
  });

  describe('isNativeAndroidApp()', () => {
    it('is true only on native Android', () => {
      isNativePlatformMock.mockReturnValue(true);
      getPlatformMock.mockReturnValue('android');
      expect(isNativeAndroidApp()).toBe(true);
    });

    it('is false on native iOS', () => {
      isNativePlatformMock.mockReturnValue(true);
      getPlatformMock.mockReturnValue('ios');
      expect(isNativeAndroidApp()).toBe(false);
    });

    it('is false on the web', () => {
      expect(isNativeAndroidApp()).toBe(false);
    });
  });
});
