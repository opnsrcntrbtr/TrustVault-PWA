/**
 * Biometric credential migration (S1 — hard cutover to PRF)
 *
 * Pure helpers shared by the DB v6 upgrade and the password-login strip so the
 * "only PRF credentials may exist" invariant is enforced in exactly one place.
 *
 * The legacy device-key scheme wrapped the vault key with a key recomputable
 * from stored values (credentialId/userId/salt). Those credentials are removed;
 * users re-enroll biometric once using PRF (master-password unlock is unaffected).
 */

import type { WebAuthnCredential } from '@/domain/entities/User';

/** A credential can unlock the vault only if it carries a complete PRF wrap. */
export function isPrfCredential(credential: WebAuthnCredential): boolean {
  return (
    credential.vaultKeyScheme === 'prf-v1' &&
    typeof credential.wrappedVaultKey === 'string' &&
    credential.wrappedVaultKey.length > 0 &&
    typeof credential.prfSalt === 'string' &&
    credential.prfSalt.length > 0
  );
}

export interface StripResult {
  /** Credentials that survive — only PRF-scheme ones. */
  credentials: WebAuthnCredential[];
  /** Recomputed biometric flag: true iff at least one PRF credential remains. */
  biometricEnabled: boolean;
  /** Whether anything was removed (used to decide if a DB write is needed). */
  changed: boolean;
}

/**
 * Drops every non-PRF (legacy/insecure) credential and recomputes the
 * biometricEnabled flag. Idempotent: a list of only PRF credentials is unchanged.
 */
export function stripLegacyBiometric(
  credentials: WebAuthnCredential[] | undefined,
): StripResult {
  const list = Array.isArray(credentials) ? credentials : [];
  const kept = list.filter(isPrfCredential);
  return {
    credentials: kept,
    biometricEnabled: kept.length > 0,
    changed: kept.length !== list.length,
  };
}
