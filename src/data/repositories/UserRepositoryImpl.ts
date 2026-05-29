/**
 * User Repository Implementation
 * Handles user authentication and management with IndexedDB storage
 */

import { hashPassword, verifyPassword, needsRehash } from '@/core/crypto/password';
import { deriveKeyFromPassword, encrypt, decrypt } from '@/core/crypto/encryption';
import { decodeBase64ToUint8Array, encodeUint8ArrayToBase64 } from '@/core/utils/base64';
import { db, type StoredUser } from '../storage/database';
import type { User, AuthSession, SecuritySettings } from '@/domain/entities/User';
import type { IUserRepository } from '@/domain/repositories/IUserRepository';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/core/auth/rateLimiter';
import { sealLegacyMetadata } from '@/data/repositories/metadataSealing';
import { stripLegacyBiometric } from '@/core/auth/biometricMigration';

export class UserRepositoryImpl implements IUserRepository {
  /**
   * Create a new user account
   */
  async createUser(email: string, masterPassword: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash the master password with Argon2id
    const hashedMasterPassword = await hashPassword(masterPassword);

    // Generate salt for vault key derivation
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);
    const saltBase64 = btoa(String.fromCharCode(...salt));

    // Derive vault key from password + salt
    const vaultKey = await deriveKeyFromPassword(masterPassword, salt);

    // Generate and encrypt the master vault key
    const masterVaultKey = new Uint8Array(32);
    crypto.getRandomValues(masterVaultKey);
    const masterVaultKeyBase64 = btoa(String.fromCharCode(...masterVaultKey));
    const encryptedVaultKey = await encrypt(masterVaultKeyBase64, vaultKey);

    // Create user entity
    const user: User = {
      id: crypto.randomUUID(),
      email,
      hashedMasterPassword,
      encryptedVaultKey: JSON.stringify(encryptedVaultKey),
      salt: saltBase64,
      biometricEnabled: false,
      webAuthnCredentials: [],
      createdAt: new Date(),
      lastLoginAt: new Date(),
      securitySettings: {
        sessionTimeoutMinutes: 15,
        requireBiometric: false,
        clipboardClearSeconds: 30,
        showPasswordStrength: true,
        enableSecurityAudit: true,
        passwordGenerationLength: 20,
        twoFactorEnabled: false,
      },
    };

    // Store in IndexedDB
    const storedUser: StoredUser = {
      ...user,
      createdAt: user.createdAt.getTime(),
      lastLoginAt: user.lastLoginAt.getTime(),
    };

    await db.users.add(storedUser);
    console.log('User created successfully:', email);

    return user;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateWithPassword(email: string, masterPassword: string): Promise<AuthSession> {
    // Rate-limit check before the expensive Scrypt verification
    await checkRateLimit(email);

    // Find user by email
    const storedUser = await db.users.where('email').equals(email).first();
    if (!storedUser) {
      await recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }

    // Verify master password
    const isValid = await verifyPassword(masterPassword, storedUser.hashedMasterPassword);
    if (!isValid) {
      await recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }

    // Auth succeeded — clear any accumulated attempt record
    await clearAttempts(email);

    // Transparently upgrade legacy/weak password hashes to current scrypt
    // parameters (S4). Best-effort: a rehash failure must never block login.
    if (needsRehash(storedUser.hashedMasterPassword)) {
      try {
        const upgradedHash = await hashPassword(masterPassword);
        await db.users.update(storedUser.id, { hashedMasterPassword: upgradedHash });
      } catch {
        // Non-fatal: the user is already authenticated with their valid password.
      }
    }

    // Derive temporary key from password + salt (used to decrypt the vault key)
    const salt = Uint8Array.from(atob(storedUser.salt), c => c.charCodeAt(0));
    const tempKey = await deriveKeyFromPassword(masterPassword, salt);

    // Decrypt the actual vault key (masterVaultKey) from storage
    const encryptedVaultKeyData = JSON.parse(storedUser.encryptedVaultKey);
    const masterVaultKeyBase64 = await decrypt(encryptedVaultKeyData, tempKey);

    // Convert base64 master vault key to raw bytes
    const masterVaultKeyBytes = Uint8Array.from(atob(masterVaultKeyBase64), c => c.charCodeAt(0));

    // Import the raw master vault key as a CryptoKey
    const vaultKey = await crypto.subtle.importKey(
      'raw',
      masterVaultKeyBytes,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );

    // Update last login time
    await db.users.update(storedUser.id, {
      lastLoginAt: Date.now(),
    });

    // Seal any pre-v5 credentials that still carry plaintext metadata (S5).
    // Awaited so the session is returned with a fully sealed vault, but wrapped
    // in try/catch so a sealing failure never blocks the login itself.
    try {
      await sealLegacyMetadata(vaultKey);
    } catch {
      // Non-fatal: user is already authenticated; sealing will retry next login.
    }

    // S1: enforce the PRF-only invariant by removing any legacy (insecure)
    // biometric credentials that slipped past the v6 migration. Non-fatal.
    try {
      const fresh = await db.users.get(storedUser.id);
      if (fresh) {
        const { credentials, biometricEnabled, changed } = stripLegacyBiometric(
          fresh.webAuthnCredentials,
        );
        if (changed) {
          await db.users.update(storedUser.id, {
            webAuthnCredentials: credentials,
            biometricEnabled,
          });
        }
      }
    } catch {
      // Non-fatal: legacy strip will retry next login.
    }

    // Create session with the actual vault key
    return {
      userId: storedUser.id,
      vaultKey,
      expiresAt: new Date(Date.now() + storedUser.securitySettings.sessionTimeoutMinutes * 60 * 1000),
      isLocked: false,
    };
  }

  /**
   * Authenticate with biometric (WebAuthn)
   */
  async authenticateWithBiometric(userId: string, credentialId: string): Promise<AuthSession> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Find the credential
    const credential = user.webAuthnCredentials.find(c => c.id === credentialId);
    if (!credential) {
      throw new Error('Biometric credential not found');
    }

    // S1: only PRF-scheme credentials can unlock the vault. Legacy device-key
    // credentials were removed by the v6 migration; ask the user to re-enroll.
    if (
      credential.vaultKeyScheme !== 'prf-v1' ||
      !credential.wrappedVaultKey ||
      !credential.prfSalt
    ) {
      throw new Error('Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.');
    }

    const rpId = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost'
      : window.location.hostname;

    const { getPRFOutput } = await import('@/core/auth/webauthn');
    const { unwrapVaultKeyWithPRF } = await import('@/core/auth/biometricVaultKey');

    // Assertion ceremony: evaluate the PRF at the stored salt. getPRFOutput also
    // verifies challenge/origin and that the counter increased (replay protection).
    const prfSaltBytes = decodeBase64ToUint8Array(credential.prfSalt);
    const { prfOutput, counter: newCounter } = await getPRFOutput(
      credentialId,
      prfSaltBytes,
      rpId,
      credential.counter,
    );

    // Unwrap the vault key with the PRF-derived key. Throws on a wrong/forged PRF
    // output (AES-GCM auth failure) — there is no insecure fallback path.
    const vaultKey = await unwrapVaultKeyWithPRF(credential.wrappedVaultKey, prfOutput);

    // Update credential with verified counter and last used time
    const updatedCredentials = user.webAuthnCredentials.map(c =>
      c.id === credentialId
        ? { ...c, counter: newCounter, lastUsedAt: new Date() }
        : c
    );

    await db.users.update(userId, {
      webAuthnCredentials: updatedCredentials,
      lastLoginAt: Date.now(),
    });

    // Seal any pre-v5 credentials that still carry plaintext metadata (S5).
    // Awaited so the session is returned with a fully sealed vault, but wrapped
    // in try/catch so a sealing failure never blocks the login itself.
    try {
      await sealLegacyMetadata(vaultKey);
    } catch {
      // Non-fatal: user is already authenticated; sealing will retry next login.
    }

    // Create session with the decrypted vault key
    return {
      userId: user.id,
      vaultKey,
      expiresAt: new Date(Date.now() + user.securitySettings.sessionTimeoutMinutes * 60 * 1000),
      isLocked: false,
    };
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const storedUser = await db.users.get(id);
    if (!storedUser) {
      return null;
    }

    return this.mapStoredUserToUser(storedUser);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const storedUser = await db.users.where('email').equals(email).first();
    if (!storedUser) {
      return null;
    }

    return this.mapStoredUserToUser(storedUser);
  }

  /**
   * Check if any users exist in the database
   */
  async hasAnyUsers(): Promise<boolean> {
    const count = await db.users.count();
    return count > 0;
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(userId: string, settings: Partial<SecuritySettings>): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await db.users.update(userId, {
      securitySettings: {
        ...user.securitySettings,
        ...settings,
      },
    });
  }

  /**
   * Register biometric credential
   */
  async registerBiometric(userId: string, vaultKey: CryptoKey, deviceName?: string): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const { isBiometricAvailable, isPRFSupported, registerCredentialWithPRF, getPRFOutput } =
      await import('@/core/auth/webauthn');

    // Check if biometric is available
    const available = await isBiometricAvailable();
    if (!available) {
      throw new Error('Biometric authentication is not available on this device');
    }

    // S1: biometric unlock REQUIRES the WebAuthn PRF extension. Without it we
    // cannot bind the vault key to the authenticator hardware, so we refuse to
    // enroll and the user keeps using their master password.
    const prfSupported = await isPRFSupported();
    if (!prfSupported) {
      throw new Error('This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.');
    }

    // Use 'localhost' for local dev, otherwise use hostname
    const rpId = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost'
      : window.location.hostname;

    // Ceremony 1 — create the credential with PRF enabled.
    const registration = await registerCredentialWithPRF({
      rpName: 'TrustVault',
      rpId,
      userId: user.id,
      userName: user.email,
      userDisplayName: user.displayName || user.email,
    });

    // Registration only *enables* PRF; if the authenticator didn't, abort and
    // store nothing (no insecure fallback).
    if (!registration.prfEnabled) {
      throw new Error('Your authenticator did not enable the PRF extension required for secure biometric unlock. Please use your master password.');
    }

    // Ceremony 2 — evaluate the PRF to obtain the wrapping secret, then wrap the
    // vault key. The PRF output and wrap key are transient (never stored).
    const { generatePrfSalt, wrapVaultKeyWithPRF } = await import('@/core/auth/biometricVaultKey');
    const prfSalt = generatePrfSalt();
    const { prfOutput } = await getPRFOutput(registration.credentialId, prfSalt, rpId);
    const wrappedVaultKey = await wrapVaultKeyWithPRF(vaultKey, prfOutput);

    const newCredential = {
      id: registration.credentialId,
      publicKey: registration.publicKey,
      counter: 0,
      transports: registration.transports,
      createdAt: new Date(),
      deviceName: deviceName || 'Biometric Device',
      vaultKeyScheme: 'prf-v1' as const,
      wrappedVaultKey,
      prfSalt: encodeUint8ArrayToBase64(prfSalt),
    };

    // Store updated credentials
    const updatedCredentials = [...user.webAuthnCredentials, newCredential];

    await db.users.update(userId, {
      webAuthnCredentials: updatedCredentials as typeof user.webAuthnCredentials,
      biometricEnabled: true,
    });
  }

  /**
   * Remove biometric credential
   */
  async removeBiometric(userId: string, credentialId: string): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove the credential
    const updatedCredentials = user.webAuthnCredentials.filter(c => c.id !== credentialId);

    // Disable biometric if no credentials remain
    const biometricEnabled = updatedCredentials.length > 0;

    await db.users.update(userId, {
      webAuthnCredentials: updatedCredentials,
      biometricEnabled,
    });

    console.log('Biometric credential removed successfully');
  }

  /**
   * Create session (placeholder - sessions handled by authStore)
   */
  async createSession(userId: string, vaultKey: CryptoKey): Promise<AuthSession> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId,
      vaultKey,
      expiresAt: new Date(Date.now() + user.securitySettings.sessionTimeoutMinutes * 60 * 1000),
      isLocked: false,
    };
  }

  /**
   * Get current session (placeholder)
   */
  async getSession(): Promise<AuthSession | null> {
    // Sessions are managed by Zustand store
    return null;
  }

  /**
   * Lock session (placeholder)
   */
  async lockSession(): Promise<void> {
    // Handled by authStore
  }

  /**
   * Unlock session (placeholder)
   */
  async unlockSession(_vaultKey: CryptoKey): Promise<void> {
    // Handled by authStore
  }

  /**
   * Destroy session (placeholder)
   */
  async destroySession(): Promise<void> {
    // Handled by authStore
  }

  /**
   * Change master password
   */
  async changeMasterPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.hashedMasterPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newHashedPassword = await hashPassword(newPassword);

    // Re-encrypt vault key with new password
    const currentSalt = Uint8Array.from(atob(user.salt), c => c.charCodeAt(0));
    const currentVaultKey = await deriveKeyFromPassword(currentPassword, currentSalt);

    const encryptedVaultKeyData = JSON.parse(user.encryptedVaultKey);
    const masterVaultKey = await decrypt(encryptedVaultKeyData, currentVaultKey);

    const newSalt = new Uint8Array(32);
    crypto.getRandomValues(newSalt);
    const newVaultKey = await deriveKeyFromPassword(newPassword, newSalt);
    const newEncryptedVaultKey = await encrypt(masterVaultKey, newVaultKey);

    // Update user
    await db.users.update(userId, {
      hashedMasterPassword: newHashedPassword,
      salt: btoa(String.fromCharCode(...newSalt)),
      encryptedVaultKey: JSON.stringify(newEncryptedVaultKey),
    });
  }

  /**
   * Get last login time
   */
  async getLastLoginTime(userId: string): Promise<Date | null> {
    const user = await db.users.get(userId);
    if (!user) {
      return null;
    }

    return new Date(user.lastLoginAt);
  }

  /**
   * Get all users with biometric authentication enabled
   */
  async getUsersWithBiometric(): Promise<User[]> {
    // Use filter instead of indexed query to avoid index dependency
    const allUsers = await db.users.toArray();
    const users = allUsers.filter(user => user.biometricEnabled);
    return users.map(this.mapStoredUserToUser);
  }

  /**
   * Get user's first biometric credential ID (for quick auth)
   */
  async getFirstBiometricCredential(userId: string): Promise<string | null> {
    const user = await db.users.get(userId);
    if (!user || !user.biometricEnabled || user.webAuthnCredentials.length === 0) {
      return null;
    }
    return user.webAuthnCredentials[0]?.id ?? null;
  }

  /**
   * Helper: Convert StoredUser to User
   */
  private mapStoredUserToUser(storedUser: StoredUser): User {
    return {
      ...storedUser,
      createdAt: new Date(storedUser.createdAt),
      lastLoginAt: new Date(storedUser.lastLoginAt),
    };
  }
}

// Export singleton instance
export const userRepository = new UserRepositoryImpl();
