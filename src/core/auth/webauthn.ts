/**
 * WebAuthn Biometric Authentication Service
 *
 * Ceremonies, PRF detection, and vault-key wrapping live in webauthn-prf-zktv
 * (extracted from this app and published as the reference implementation for
 * the accompanying research paper). This module keeps only the app-specific
 * seams the package deliberately doesn't own: the Capacitor native-app gate,
 * device-name/authenticator-info UX helpers, and thin re-exports.
 */

import {
  detectPrfSupport,
  isPrfViableOnThisClient,
  isWebAuthnSupported as zktvIsWebAuthnSupported,
  type PrfSupport,
} from 'webauthn-prf-zktv/webauthn';
import { isNativeApp } from '@/core/platform/runtime';

/**
 * Checks if WebAuthn is supported in the browser
 */
export function isWebAuthnSupported(): boolean {
  return zktvIsWebAuthnSupported();
}

/**
 * Checks if platform authenticator (biometric) is available.
 *
 * Forced OFF inside the native Capacitor app: the `prf-v1` unlock relies on the
 * WebAuthn PRF extension, which does not pass through the Android WebView →
 * Credential Manager path, and Credential Manager binds the origin to the app
 * signature rather than the web RP ID (see
 * docs/OCR_PHASE2_BIOMETRIC_WEBVIEW_SPIKE.md). The native build therefore uses
 * master-password unlock only, and biometric enrollment/UI stays hidden.
 * `isPrfViableOnThisClient()` detects the same WebView constraint outside
 * Capacitor (e.g. other in-app browsers), so it's checked as a second gate.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (isNativeApp()) {
    return false;
  }

  if (!isWebAuthnSupported()) {
    return false;
  }

  const viability = await isPrfViableOnThisClient();
  if (viability.environment === 'webview') {
    return false;
  }

  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('Failed to check biometric availability:', error);
    return false;
  }
}

/**
 * Gets authenticator info (for debugging)
 */
export async function getAuthenticatorInfo(): Promise<{
  biometricAvailable: boolean;
  conditionalMediationAvailable: boolean;
}> {
  const biometricAvailable = await isBiometricAvailable();

  let conditionalMediationAvailable = false;
  if (typeof window.PublicKeyCredential === 'function') {
    conditionalMediationAvailable = await window.PublicKeyCredential.isConditionalMediationAvailable();
  }

  return {
    biometricAvailable,
    conditionalMediationAvailable,
  };
}

/**
 * Gets user-friendly device name based on platform
 */
export function getDeviceName(userAgentOverride?: string): string {
  const ua = userAgentOverride ?? navigator.userAgent;

  // Check more specific platforms first (iPhone/iPad before Mac)
  if (ua.includes('iPhone')) return 'iPhone Face ID';
  if (ua.includes('iPad')) return 'iPad Face ID';
  if (ua.includes('Mac')) return 'Mac Touch ID';
  if (ua.includes('Windows')) return 'Windows Hello';
  // Android before Linux: Android user-agents also contain "Linux".
  if (ua.includes('Android')) return 'Android Biometric';
  if (ua.includes('Linux')) return 'Linux Biometric';

  return 'Biometric Device';
}

/**
 * Tri-state PRF capability detection for UI gating (delegates to
 * webauthn-prf-zktv, which never probes with throwaway credentials).
 *  - 'supported'   : client capabilities positively report the PRF extension
 *  - 'unsupported' : WebAuthn is absent, or capabilities report PRF unavailable
 *  - 'unknown'     : capabilities can't be queried (PublicKeyCredential.
 *                    getClientCapabilities is not yet universal). Enrollment is
 *                    still attempted and hard-verifies PRF via `prf.enabled` and
 *                    the assertion's PRF result, falling back to the master
 *                    password with a clear message if PRF turns out unavailable.
 */
export type PRFSupport = PrfSupport;

export async function detectPRFSupport(): Promise<PRFSupport> {
  return detectPrfSupport();
}

/**
 * Boolean convenience for the enrollment pre-check: false only when PRF is
 * *known* to be unsupported, so 'unknown' clients still attempt enrollment
 * (which hard-verifies PRF) instead of being denied biometric outright.
 */
export async function isPRFSupported(): Promise<boolean> {
  return (await detectPRFSupport()) !== 'unsupported';
}
