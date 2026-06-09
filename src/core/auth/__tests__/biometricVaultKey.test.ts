/**
 * S1 — WebAuthn PRF vault-key wrapping tests
 *
 * SECURITY_PWA_ENHANCEMENT_PLAN.md §S1:
 * The biometric vault key MUST be wrapped with a key derived from the
 * authenticator's PRF output (HKDF-SHA256), NOT from values stored in
 * IndexedDB. These tests prove:
 *   1. Determinism + round-trip: same PRF output unwraps the vault key.
 *   2. Wrong PRF output fails (AES-GCM auth-tag failure, no silent fallback).
 *   3. Non-recomputability: a key derived from stored/public values
 *      (the OLD insecure device-key scheme) cannot unwrap a PRF-wrapped blob.
 *
 * S7 (SECURITY_HARDENING_PLAN_2026-06.md): wrapVaultKeyWithPRF takes RAW
 * vault-key bytes (so the session CryptoKey can stay non-extractable), and
 * unwrapVaultKeyWithPRF returns a NON-extractable key. Equality is therefore
 * proven behaviourally (encrypt with one key, decrypt with the other) instead
 * of by exporting raw key material.
 */
import { describe, it, expect } from 'vitest';
import {
  generatePrfSalt,
  deriveWrapKeyFromPRF,
  wrapVaultKeyWithPRF,
  unwrapVaultKeyWithPRF,
} from '@/core/auth/biometricVaultKey';
import { encrypt, decrypt } from '@/core/crypto/encryption';

/** A fixed, deterministic 32-byte "PRF output" standing in for the authenticator. */
function fixedPrfOutput(seed = 7): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = (seed * 31 + i) & 0xff;
  return out;
}

/** Deterministic raw vault-key bytes for tests. */
function fixedVaultKeyRaw(seed = 5): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 0; i < out.length; i++) out[i] = (seed * 17 + i * 3) & 0xff;
  return out;
}

/** Import raw bytes as an AES-GCM key (reference copy for behavioural checks). */
async function importRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Proves two AES-GCM keys are the same key without exporting either. */
async function expectSameKey(a: CryptoKey, b: CryptoKey): Promise<void> {
  const sample = 'vault-key-equality-probe';
  const sealed = await encrypt(sample, a);
  await expect(decrypt(sealed, b)).resolves.toBe(sample);
}

describe('generatePrfSalt', () => {
  it('returns 32 random bytes', () => {
    const salt = generatePrfSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });

  it('is non-deterministic across calls', () => {
    const a = generatePrfSalt();
    const b = generatePrfSalt();
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('deriveWrapKeyFromPRF (HKDF-SHA256)', () => {
  it('derives a usable AES-GCM key', async () => {
    const key = await deriveWrapKeyFromPRF(fixedPrfOutput());
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('is deterministic: same PRF output yields a key that decrypts the other key\'s output', async () => {
    // Keys are non-extractable, so prove determinism behaviourally:
    // wrap with one derivation, unwrap with a freshly derived key from the SAME output.
    const vaultKeyRaw = fixedVaultKeyRaw();
    const reference = await importRaw(vaultKeyRaw);
    const prf = fixedPrfOutput();
    const wrapped = await wrapVaultKeyWithPRF(vaultKeyRaw, prf);
    const unwrapped = await unwrapVaultKeyWithPRF(wrapped, prf);
    await expectSameKey(reference, unwrapped);
  });
});

describe('wrap / unwrap round-trip', () => {
  it('unwraps to the identical vault key', async () => {
    const vaultKeyRaw = fixedVaultKeyRaw(11);
    const reference = await importRaw(vaultKeyRaw);
    const prf = fixedPrfOutput(11);
    const wrapped = await wrapVaultKeyWithPRF(vaultKeyRaw, prf);
    const unwrapped = await unwrapVaultKeyWithPRF(wrapped, prf);
    await expectSameKey(reference, unwrapped);
  });

  it('produces different ciphertext each wrap (random IV) but both unwrap correctly', async () => {
    const vaultKeyRaw = fixedVaultKeyRaw(13);
    const reference = await importRaw(vaultKeyRaw);
    const prf = fixedPrfOutput(13);
    const w1 = await wrapVaultKeyWithPRF(vaultKeyRaw, prf);
    const w2 = await wrapVaultKeyWithPRF(vaultKeyRaw, prf);
    expect(w1).not.toBe(w2); // different IV/ciphertext
    await expectSameKey(reference, await unwrapVaultKeyWithPRF(w1, prf));
    await expectSameKey(reference, await unwrapVaultKeyWithPRF(w2, prf));
  });

  it('never stores the raw vault key in the wrapped blob', async () => {
    const vaultKeyRaw = fixedVaultKeyRaw(17);
    const rawB64 = btoa(String.fromCharCode(...vaultKeyRaw));
    const wrapped = await wrapVaultKeyWithPRF(vaultKeyRaw, fixedPrfOutput(17));
    expect(wrapped).not.toContain(rawB64);
  });
});

describe('S7: unwrapped session key is non-extractable', () => {
  it('marks the unwrapped vault key non-extractable and exportKey rejects', async () => {
    const prf = fixedPrfOutput(29);
    const wrapped = await wrapVaultKeyWithPRF(fixedVaultKeyRaw(29), prf);
    const unwrapped = await unwrapVaultKeyWithPRF(wrapped, prf);

    expect(unwrapped.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', unwrapped)).rejects.toThrow();
  });
});

describe('SECURITY: wrong PRF output cannot unwrap', () => {
  it('rejects when the PRF output differs by a single byte', async () => {
    const prf = fixedPrfOutput(19);
    const wrapped = await wrapVaultKeyWithPRF(fixedVaultKeyRaw(19), prf);

    const wrong = fixedPrfOutput(19);
    wrong[0] = ((wrong[0] ?? 0) ^ 0x01) & 0xff; // flip one bit

    await expect(unwrapVaultKeyWithPRF(wrapped, wrong)).rejects.toThrow();
  });
});

describe('SECURITY: storage-derivable key cannot unwrap (non-recomputability)', () => {
  it('a key derived from stored/public values (old device-key scheme) fails to unwrap a PRF-wrapped blob', async () => {
    const prfSalt = generatePrfSalt();
    const prfOutput = fixedPrfOutput(23); // only the authenticator could produce this
    const wrapped = await wrapVaultKeyWithPRF(fixedVaultKeyRaw(23), prfOutput);

    // Reconstruct what an attacker has from IndexedDB: credentialId, userId, prfSalt.
    // Re-derive a key the OLD insecure way (PBKDF2 over public material) and try it
    // as if it were the PRF output — it must NOT unwrap the vault.
    const credentialId = 'stored-credential-id';
    const userId = 'stored-user-id';
    const ikm = new TextEncoder().encode(`${credentialId}:${userId}`);
    const baseKey = await crypto.subtle.importKey('raw', ikm, 'PBKDF2', false, ['deriveBits']);
    const recomputed = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: prfSalt as BufferSource, iterations: 600000, hash: 'SHA-256' },
        baseKey,
        256,
      ),
    );

    await expect(unwrapVaultKeyWithPRF(wrapped, recomputed)).rejects.toThrow();
  });
});
