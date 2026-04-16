/**
 * Domain Entity: User
 * Represents authenticated user with security metadata
 */
export interface User {
  id: string;
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
  // Encrypted vault key specifically for this biometric credential
  // Encrypted using a device-specific key derived from the credential
  encryptedVaultKey?: string;
  // Salt used for deriving the device-specific encryption key
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
