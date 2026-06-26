import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the optional native Android build.
 *
 * The web PWA remains the primary, fully-functional surface (Tesseract OCR).
 * This wrapper exists only to add the on-device ML Kit OCR path on Android —
 * see docs/OCR_NATIVE_ANDROID_PLAN.md.
 *
 * Unlock on this surface is master-password only; biometric/PRF is disabled here
 * because WebAuthn PRF does not pass through the Android WebView/Credential
 * Manager path (see docs/OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md).
 */
const config: CapacitorConfig = {
  appId: 'io.trustvault.app',
  appName: 'TrustVault',
  webDir: 'dist',
  server: {
    // Serve from https://localhost so the in-WebView origin is a secure context,
    // closest to the deployed CSP/origin model.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
