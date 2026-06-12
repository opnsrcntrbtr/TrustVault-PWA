/**
 * Finding 3: the offline-attackable artifact is encryptedVaultKey, so the
 * wrap key must come from the memory-hard scrypt KDF (S4 params), not
 * PBKDF2. Legacy PBKDF2-wrapped users upgrade transparently on login.
 */
import { describe, it, expect } from 'vitest';
import { deriveVaultWrapKey, deriveKeyFromPassword, encrypt, decrypt } from '@/core/crypto/encryption';

describe('deriveVaultWrapKey (scrypt-v1)', () => {
  const salt = new Uint8Array(32).fill(7);

  it('round-trips an AES-GCM payload', async () => {
    const key = await deriveVaultWrapKey('correct horse battery staple', salt);
    const ct = await encrypt('vault-key-bytes-b64', key);
    expect(await decrypt(ct, key)).toBe('vault-key-bytes-b64');
  }, 30000);

  it('is deterministic for same password+salt and differs across passwords', async () => {
    const k1 = await deriveVaultWrapKey('pw-one-是-long-enough', salt);
    const k2 = await deriveVaultWrapKey('pw-one-是-long-enough', salt);
    const k3 = await deriveVaultWrapKey('pw-two-completely-diff', salt);
    const ct = await encrypt('probe', k1);
    expect(await decrypt(ct, k2)).toBe('probe');          // same inputs → same key
    await expect(decrypt(ct, k3)).rejects.toThrow();       // different pw → auth failure
  }, 30000);

  it('produces a different key than the legacy PBKDF2 derivation', async () => {
    const scryptKey = await deriveVaultWrapKey('same-password-here', salt);
    const pbkdf2Key = await deriveKeyFromPassword('same-password-here', salt);
    const ct = await encrypt('probe', scryptKey);
    await expect(decrypt(ct, pbkdf2Key)).rejects.toThrow();
  }, 30000);

  it('returns a non-extractable AES-GCM key', async () => {
    const key = await deriveVaultWrapKey('pw', salt);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
  }, 30000);
});
