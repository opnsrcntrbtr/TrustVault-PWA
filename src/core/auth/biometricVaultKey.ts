/**
 * Biometric Vault Key Wrapping (WebAuthn PRF — S1)
 *
 * The vault key is wrapped with a key derived from the authenticator's
 * **PRF (HMAC-secret) output** via HKDF-SHA256. The PRF output is produced by
 * the authenticator hardware ONLY after user verification (biometric) and is
 * NEVER stored anywhere. Therefore neither an XSS payload nor a full IndexedDB
 * dump can re-derive the wrapping key — unlike the previous device-key scheme,
 * whose inputs (credentialId, userId, salt) were all stored and recomputable.
 *
 * Storage layout (per WebAuthn credential):
 *   - prfSalt:          random per-credential PRF input (non-secret)
 *   - wrappedVaultKey:  JSON.stringify(EncryptedData) of the AES-GCM-wrapped vault key
 *   - vaultKeyScheme:   'prf-v1'
 *
 * The PRF output and the derived wrap key are transient and only ever live in
 * memory during an enroll or unlock ceremony.
 */

import { encrypt, decrypt, type EncryptedData } from '@/core/crypto/encryption';
import { encodeUint8ArrayToBase64, decodeBase64ToUint8Array } from '@/core/utils/base64';

/** Domain-separation label for HKDF — binds the derived key to this exact purpose. */
const HKDF_INFO = 'TrustVault Vault Key Wrapping v1';

/** PRF salt length in bytes (the PRF "input"/"first" evaluation point). */
const PRF_SALT_LENGTH = 32;

/**
 * Generates a random per-credential PRF salt. This is the non-secret input that
 * is fed to the authenticator's PRF; the same salt always yields the same PRF
 * output from the same credential, but only the authenticator can compute it.
 */
export function generatePrfSalt(): Uint8Array {
  const salt = new Uint8Array(PRF_SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derives a non-extractable AES-256-GCM wrapping key from the raw PRF output
 * using HKDF-SHA256. The PRF output is treated as Input Keying Material (IKM),
 * never as the final key directly.
 */
export async function deriveWrapKeyFromPRF(prfOutput: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    prfOutput as BufferSource,
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // RFC 5869: an empty salt is valid (treated as zeros). Per-credential
      // domain separation already comes from the unique PRF salt → unique IKM.
      salt: new Uint8Array(0) as BufferSource,
      info: new TextEncoder().encode(HKDF_INFO) as BufferSource,
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable — the wrap key never leaves WebCrypto
    ['encrypt', 'decrypt'],
  );
}

/**
 * Wraps (encrypts) the raw vault key bytes with a PRF-derived key.
 * Returns a JSON string (EncryptedData) suitable for storage in
 * WebAuthnCredential.wrappedVaultKey. The raw vault key is never persisted.
 *
 * S7: takes raw bytes (not a CryptoKey) so the session vault key can stay
 * non-extractable. The caller obtains the bytes by decrypting the stored
 * encryptedVaultKey with the master password and MUST zeroize them after.
 */
export async function wrapVaultKeyWithPRF(
  vaultKeyRaw: Uint8Array,
  prfOutput: Uint8Array,
): Promise<string> {
  const wrapKey = await deriveWrapKeyFromPRF(prfOutput);

  const rawBase64 = encodeUint8ArrayToBase64(vaultKeyRaw);
  const encrypted = await encrypt(rawBase64, wrapKey);
  return JSON.stringify(encrypted);
}

/**
 * Unwraps (decrypts) the vault key using a PRF-derived key.
 * Throws if the PRF output is wrong (AES-GCM authentication failure) — there is
 * no fallback path, so an incorrect/forged PRF output can never unlock the vault.
 */
export async function unwrapVaultKeyWithPRF(
  wrappedVaultKeyJson: string,
  prfOutput: Uint8Array,
): Promise<CryptoKey> {
  const wrapKey = await deriveWrapKeyFromPRF(prfOutput);

  const encrypted = JSON.parse(wrappedVaultKeyJson) as EncryptedData;
  const rawBase64 = await decrypt(encrypted, wrapKey); // throws on wrong key
  const rawBytes = decodeBase64ToUint8Array(rawBase64);

  try {
    // S7: NON-extractable — the session vault key never leaves WebCrypto.
    // Matches the password-unlock path (UserRepositoryImpl.authenticateWithPassword).
    return await crypto.subtle.importKey(
      'raw',
      rawBytes as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    // Zeroize the transient raw key bytes regardless of import outcome.
    rawBytes.fill(0);
  }
}
