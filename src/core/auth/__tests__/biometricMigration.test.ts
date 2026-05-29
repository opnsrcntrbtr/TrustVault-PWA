/**
 * S1 — biometric migration helper tests (DB v6 strip logic)
 */
import { describe, it, expect } from 'vitest';
import { isPrfCredential, stripLegacyBiometric } from '@/core/auth/biometricMigration';
import type { WebAuthnCredential } from '@/domain/entities/User';

const legacy: WebAuthnCredential = {
  id: 'legacy-1',
  publicKey: 'pk',
  counter: 0,
  createdAt: new Date(),
  encryptedVaultKey: 'old-blob',
  salt: 'old-salt',
};

const prf: WebAuthnCredential = {
  id: 'prf-1',
  publicKey: 'pk',
  counter: 3,
  createdAt: new Date(),
  vaultKeyScheme: 'prf-v1',
  wrappedVaultKey: '{"ciphertext":"x","iv":"y"}',
  prfSalt: 'c2FsdA==',
};

describe('isPrfCredential', () => {
  it('accepts a complete prf-v1 credential', () => {
    expect(isPrfCredential(prf)).toBe(true);
  });
  it('rejects a legacy device-key credential', () => {
    expect(isPrfCredential(legacy)).toBe(false);
  });
  it('rejects a prf-v1 credential missing the wrapped key', () => {
    expect(isPrfCredential({ ...prf, wrappedVaultKey: undefined })).toBe(false);
  });
  it('rejects a prf-v1 credential missing the salt', () => {
    expect(isPrfCredential({ ...prf, prfSalt: '' })).toBe(false);
  });
});

describe('stripLegacyBiometric', () => {
  it('removes legacy credentials and disables biometric when none remain', () => {
    const result = stripLegacyBiometric([legacy]);
    expect(result.credentials).toEqual([]);
    expect(result.biometricEnabled).toBe(false);
    expect(result.changed).toBe(true);
  });

  it('keeps prf-v1 credentials and enables biometric', () => {
    const result = stripLegacyBiometric([prf]);
    expect(result.credentials).toEqual([prf]);
    expect(result.biometricEnabled).toBe(true);
    expect(result.changed).toBe(false);
  });

  it('removes only the legacy ones from a mixed list', () => {
    const result = stripLegacyBiometric([legacy, prf]);
    expect(result.credentials).toEqual([prf]);
    expect(result.biometricEnabled).toBe(true);
    expect(result.changed).toBe(true);
  });

  it('handles undefined/empty input', () => {
    expect(stripLegacyBiometric(undefined)).toEqual({ credentials: [], biometricEnabled: false, changed: false });
    expect(stripLegacyBiometric([])).toEqual({ credentials: [], biometricEnabled: false, changed: false });
  });
});
