/**
 * WebAuthn Biometric Authentication Service
 * Implements fingerprint and face recognition using SimpleWebAuthn
 * FIDO2 compliant biometric authentication
 */

import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/types';
import {
  decodeBase64ToString,
  decodeBase64ToUint8Array,
  encodeUint8ArrayToBase64,
  encodeUint8ArrayToBase64Url,
} from '@/core/utils/base64';

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransport[];
  createdAt: Date;
  deviceName?: string;
}

export interface RegistrationOptions {
  rpName: string; // Relying Party name
  rpId: string; // Domain
  userId: string;
  userName: string;
  userDisplayName: string;
  timeout?: number;
  attestationType?: AttestationConveyancePreference;
}

/**
 * Checks if WebAuthn is supported in the browser
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

/**
 * Checks if platform authenticator (biometric) is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
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
 * Registers a new biometric credential
 */
export async function registerBiometric(
  options: RegistrationOptions
): Promise<RegistrationResponseJSON> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  try {
    // Create registration options
    const registrationOptions: PublicKeyCredentialCreationOptionsJSON = {
      rp: {
        name: options.rpName,
        id: options.rpId,
      },
      user: {
        id: options.userId,
        name: options.userName,
        displayName: options.userDisplayName,
      },
      challenge: generateChallenge(),
      pubKeyCredParams: [
        { type: 'public-key' as const, alg: -7 }, // ES256
        { type: 'public-key' as const, alg: -257 }, // RS256
      ],
      timeout: options.timeout || 60000,
      attestation: options.attestationType || 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const, // Use platform authenticator (biometric)
        requireResidentKey: false,
        residentKey: 'preferred' as const,
        userVerification: 'required' as const, // Require biometric verification
      },
    };

    // Start registration ceremony
    const response = await startRegistration(registrationOptions);
    return response;
  } catch (error) {
    console.error('Biometric registration failed:', error);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric registration was cancelled or not allowed. Please ensure you\'re using HTTPS or localhost and try again.');
      }
      if (error.name === 'NotSupportedError') {
        throw new Error('Your device does not support biometric authentication.');
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('This biometric credential is already registered.');
      }
    }
    
    throw new Error('Failed to register biometric credential. Please try again.');
  }
}

/**
 * Authenticates using biometric credential
 */
export async function authenticateBiometric(
  credentialId: string,
  rpId: string
): Promise<{ response: AuthenticationResponseJSON; challenge: string }> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  try {
    const challenge = generateChallenge();
    const authenticationOptions = {
      challenge,
      timeout: 60000,
      rpId: rpId,
      allowCredentials: [
        {
          id: credentialId,
          type: 'public-key' as const,
          transports: ['internal'] as AuthenticatorTransport[],
        },
      ],
      userVerification: 'required' as const,
    };

    const response = await startAuthentication(authenticationOptions);
    return { response, challenge };
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    throw new Error('Failed to authenticate with biometric');
  }
}

/**
 * Generates a cryptographically secure challenge
 */
function generateChallenge(): string {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return encodeUint8ArrayToBase64Url(challenge);
}

/**
 * Verifies WebAuthn registration response
 * @param response Registration response from authenticator
 * @param expectedChallenge The challenge that was sent
 * @returns True if valid
 */
export function verifyRegistrationResponse(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): boolean {
  // Basic validation - in production, you'd verify:
  // 1. Challenge matches
  // 2. Origin matches
  // 3. Attestation statement is valid
  // 4. Public key is valid
  
  if (!response.id || !response.response.clientDataJSON) {
    return false;
  }

  // Decode and verify client data
  try {
    const clientDataJSON = decodeBase64ToString(response.response.clientDataJSON);
    const clientData = JSON.parse(clientDataJSON) as {
      type: string;
      challenge: string;
      origin: string;
    };

    // Verify type
    if (clientData.type !== 'webauthn.create') {
      return false;
    }

    if (clientData.challenge !== expectedChallenge) {
      throw new Error('Challenge mismatch — possible replay attack');
    }

    if (clientData.origin !== window.location.origin) {
      throw new Error('Origin mismatch');
    }

    return true;
  } catch (error) {
    console.error('Failed to verify registration response:', error);
    return false;
  }
}

/**
 * Verifies WebAuthn authentication response
 * @param response Authentication response from authenticator
 * @param expectedChallenge The challenge that was sent
 * @param storedCounter The stored signature counter
 * @returns New counter value if valid, throws if invalid
 */
export function verifyAuthenticationResponse(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  storedCounter: number
): number {
  if (!response.id || !response.response.authenticatorData) {
    throw new Error('Invalid authentication response');
  }

  try {
    const clientDataJSON = decodeBase64ToString(response.response.clientDataJSON);
    const clientData = JSON.parse(clientDataJSON) as {
      type: string;
      challenge: string;
      origin: string;
    };

    if (clientData.type !== 'webauthn.get') {
      throw new Error('Invalid authentication type');
    }

    if (clientData.challenge !== expectedChallenge) {
      throw new Error('Challenge mismatch — possible replay attack');
    }

    if (clientData.origin !== window.location.origin) {
      throw new Error('Origin mismatch');
    }

    // Extract counter from authenticator data (last 4 bytes of authenticatorData)
    const authDataBytes = decodeBase64ToUint8Array(response.response.authenticatorData);

    // Counter is at bytes 33-36
    const counter =
      ((authDataBytes[33] ?? 0) << 24) |
      ((authDataBytes[34] ?? 0) << 16) |
      ((authDataBytes[35] ?? 0) << 8) |
      (authDataBytes[36] ?? 0);

    // Verify counter increased (prevents replay attacks)
    if (counter <= storedCounter && counter !== 0) {
      throw new Error('Counter did not increase - possible cloned authenticator');
    }

    return counter;
  } catch (error) {
    console.error('Failed to verify authentication response:', error);
    throw error;
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

// ───────────────────────────── WebAuthn PRF (S1) ─────────────────────────────
// Native-API helpers for the PRF extension. We bypass @simplewebauthn/browser
// here because v10 does not surface the binary PRF results; the native
// PublicKeyCredential.getClientExtensionResults() gives us the raw bytes.

/** Minimal local typing for the PRF extension inputs (avoids lib.dom version drift). */
interface PRFExtensionInputs {
  prf?: { eval?: { first: BufferSource; second?: BufferSource } };
}
/** Minimal local typing for the PRF extension outputs. */
interface PRFExtensionOutputs {
  prf?: {
    enabled?: boolean;
    results?: { first?: ArrayBuffer | Uint8Array; second?: ArrayBuffer | Uint8Array };
  };
}

/**
 * Tri-state PRF capability detection for UI gating.
 *  - 'supported'   : client capabilities positively report the PRF extension
 *  - 'unsupported' : WebAuthn is absent, or capabilities report PRF unavailable
 *  - 'unknown'     : capabilities can't be queried (PublicKeyCredential.
 *                    getClientCapabilities is not yet universal). Enrollment is
 *                    still attempted and hard-verifies PRF via `prf.enabled` and
 *                    the assertion's PRF result, falling back to the master
 *                    password with a clear message if PRF turns out unavailable.
 */
export type PRFSupport = 'supported' | 'unsupported' | 'unknown';

export async function detectPRFSupport(): Promise<PRFSupport> {
  if (!isWebAuthnSupported()) {
    return 'unsupported';
  }
  try {
    const pkc = window.PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
    };
    if (typeof pkc.getClientCapabilities === 'function') {
      const caps = await pkc.getClientCapabilities();
      const prf = caps['extension:prf'] ?? caps['prf'];
      if (typeof prf === 'boolean') {
        return prf ? 'supported' : 'unsupported';
      }
    }
  } catch {
    // capability query failed — treat as unknown, not a hard "no"
  }
  return 'unknown';
}

/**
 * Boolean convenience for the enrollment pre-check: false only when PRF is
 * *known* to be unsupported, so 'unknown' clients still attempt enrollment
 * (which hard-verifies PRF) instead of being denied biometric outright.
 */
export async function isPRFSupported(): Promise<boolean> {
  return (await detectPRFSupport()) !== 'unsupported';
}

export interface PRFRegistrationResult {
  credentialId: string; // base64url
  publicKey: string; // base64 (best-effort SPKI)
  transports: AuthenticatorTransport[];
  prfEnabled: boolean;
}

/**
 * Registers a new platform credential with the PRF extension enabled (native API).
 * Registration only *enables* the authenticator's PRF key — it does not yield the
 * secret. Callers MUST check `prfEnabled` and abort enrollment if it is false.
 */
export async function registerCredentialWithPRF(
  options: RegistrationOptions,
): Promise<PRFRegistrationResult> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(options.userId);

  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: { name: options.rpName, id: options.rpId },
    user: { id: userIdBytes as BufferSource, name: options.userName, displayName: options.userDisplayName },
    challenge: challenge as BufferSource,
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    timeout: options.timeout ?? 60000,
    attestation: options.attestationType ?? 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: 'required',
    },
    extensions: ({ prf: {} } as unknown) as AuthenticationExtensionsClientInputs,
  };

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  } catch (error) {
    // Translate common WebAuthn failures into actionable messages (parity with
    // the legacy registerBiometric() UX).
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Biometric registration was cancelled or not allowed. Please ensure you are using HTTPS or localhost and try again.');
      }
      if (error.name === 'NotSupportedError') {
        throw new Error('Your device does not support biometric authentication.');
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('This biometric credential is already registered on this device.');
      }
    }
    throw new Error('Failed to register biometric credential. Please try again.');
  }
  if (!credential) {
    throw new Error('Biometric registration returned no credential');
  }

  const ext = credential.getClientExtensionResults() as unknown as PRFExtensionOutputs;
  const prfEnabled = ext.prf?.enabled === true;

  const response = credential.response as AuthenticatorAttestationResponse;
  const transports =
    typeof response.getTransports === 'function'
      ? (response.getTransports() as AuthenticatorTransport[])
      : [];
  const spki = typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
  const publicKeyB64 = spki ? encodeUint8ArrayToBase64(new Uint8Array(spki)) : '';

  return {
    credentialId: encodeUint8ArrayToBase64Url(new Uint8Array(credential.rawId)),
    publicKey: publicKeyB64,
    transports,
    prfEnabled,
  };
}

export interface PRFAuthResult {
  prfOutput: Uint8Array;
  counter: number;
}

/**
 * Performs an assertion ceremony that evaluates the PRF at `prfSalt` and returns
 * the raw PRF output plus the verified signature counter. Throws if the
 * authenticator does not return a PRF result (PRF unsupported) or if the
 * challenge/origin/counter verification fails (replay protection).
 *
 * `storedCounter` defaults to -1 so the counter check is a no-op during the
 * enroll second-ceremony (brand-new credential); unlock passes the real counter.
 */
export async function getPRFOutput(
  credentialId: string,
  prfSalt: Uint8Array,
  rpId: string,
  storedCounter = -1,
): Promise<PRFAuthResult> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const challengeB64Url = encodeUint8ArrayToBase64Url(challenge);
  const credIdBytes = decodeBase64ToUint8Array(credentialId);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: challenge as BufferSource,
    timeout: 60000,
    rpId,
    allowCredentials: [
      { id: credIdBytes as BufferSource, type: 'public-key', transports: ['internal'] },
    ],
    userVerification: 'required',
    extensions: ({ prf: { eval: { first: prfSalt as BufferSource } } } as PRFExtensionInputs) as AuthenticationExtensionsClientInputs,
  };

  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  } catch (error) {
    // Translate user-driven failures (cancel/timeout) instead of leaking a raw
    // DOMException into the unlock/enroll UI.
    if (error instanceof Error && error.name === 'NotAllowedError') {
      throw new Error('Biometric authentication was cancelled or timed out. Please try again or use your master password.');
    }
    throw new Error('Biometric authentication failed. Please try again or use your master password.');
  }
  if (!assertion) {
    throw new Error('Biometric authentication returned no assertion');
  }

  const ext = assertion.getClientExtensionResults() as unknown as PRFExtensionOutputs;
  const first = ext.prf?.results?.first;
  if (!first) {
    throw new Error(
      'Authenticator did not return a PRF result. This device does not support PRF; please use your master password.',
    );
  }
  const prfOutput = first instanceof Uint8Array ? first : new Uint8Array(first);

  // Replay protection: verify challenge/origin/counter via the existing verifier
  // by mapping the native assertion into the JSON shape it expects.
  const response = assertion.response as AuthenticatorAssertionResponse;
  const authResponseJSON = {
    id: assertion.id,
    rawId: encodeUint8ArrayToBase64Url(new Uint8Array(assertion.rawId)),
    response: {
      clientDataJSON: encodeUint8ArrayToBase64Url(new Uint8Array(response.clientDataJSON)),
      authenticatorData: encodeUint8ArrayToBase64Url(new Uint8Array(response.authenticatorData)),
      signature: encodeUint8ArrayToBase64Url(new Uint8Array(response.signature)),
      userHandle: response.userHandle
        ? encodeUint8ArrayToBase64Url(new Uint8Array(response.userHandle))
        : undefined,
    },
    type: assertion.type,
    clientExtensionResults: {},
    authenticatorAttachment: assertion.authenticatorAttachment ?? undefined,
  } as AuthenticationResponseJSON;

  const counter = verifyAuthenticationResponse(authResponseJSON, challengeB64Url, storedCounter);

  return { prfOutput, counter };
}
