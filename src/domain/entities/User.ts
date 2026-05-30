/**
 * Domain Entity: User
 * Represents authenticated user with security metadata
 */
export interface User {
  id: string;
  /**
   * Primary, unique login identity (case-insensitive via `usernameLower`).
   * Optional on the type during the email→username transition (DB v7 backfills
   * existing rows); `createUser` makes it mandatory for new accounts.
   */
  username?: string;
  /** Optional recovery hint only. Never transmitted — stored locally. */
  email: string;
  displayName?: string;
  hashedMasterPassword: string; // Argon2id hash
  encryptedVaultKey: string; // Master key encrypted with derived key
  salt: string; // For PBKDF2 key derivation
  biometricEnabled: boolean;
  webAuthnCredentials: WebAuthnCredential[];
  createdAt: Date;
  lastLoginAt: Date;
  securitySettings: SecuritySettings;
}

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransport[];
  createdAt: Date;
  lastUsedAt?: Date;
  deviceName?: string;

  // ── PRF vault-key wrapping (S1) ────────────────────────────────────────────
  // Vault key wrapped with a key derived from the authenticator's PRF output via
  // HKDF. The PRF output is held in hardware and never stored, so these fields
  // alone cannot unlock the vault — that is the zero-knowledge guarantee.
  /** Scheme marker; only 'prf-v1' credentials can unlock the vault. */
  vaultKeyScheme?: 'prf-v1';
  /** Vault key wrapped with the PRF-derived key (JSON.stringify of EncryptedData). */
  wrappedVaultKey?: string;
  /** Per-credential PRF salt (base64) — the non-secret PRF evaluation input. */
  prfSalt?: string;

  // ── Legacy device-key scheme (pre-S1) ──────────────────────────────────────
  // Recomputable from stored values and therefore insecure. Read-only; the DB v6
  // migration and password-login strip remove these and require PRF re-enrollment.
  /** @deprecated Insecure device-key scheme; removed by the v6 migration. */
  encryptedVaultKey?: string;
  /** @deprecated Insecure device-key salt; removed by the v6 migration. */
  salt?: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number; // Auto-lock timeout
  requireBiometric: boolean;
  clipboardClearSeconds: number;
  showPasswordStrength: boolean;
  enableSecurityAudit: boolean;
  passwordGenerationLength: number;
  twoFactorEnabled: boolean;
}

export interface AuthSession {
  userId: string;
  vaultKey: CryptoKey; // Decrypted master key for session
  expiresAt: Date;
  isLocked: boolean;
}
