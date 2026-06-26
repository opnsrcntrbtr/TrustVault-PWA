/**
 * Platform runtime detection — single source of truth for "are we running
 * inside the native Capacitor app" vs. the browser PWA.
 *
 * On the web build, `@capacitor/core` is present but reports a non-native
 * platform, so these are safe no-ops (false) everywhere except the wrapped
 * Android app. Used to:
 *  - select the native ML Kit OCR provider (native Android only), and
 *  - disable the WebAuthn/PRF biometric unlock on the native surface, where PRF
 *    does not pass through the WebView → Credential Manager path
 *    (see docs/OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md). The native build uses
 *    master-password unlock only.
 */

import { Capacitor } from '@capacitor/core';

/** True when running inside the native Capacitor shell (Android or iOS). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** True only when running inside the native Capacitor shell on Android. */
export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
