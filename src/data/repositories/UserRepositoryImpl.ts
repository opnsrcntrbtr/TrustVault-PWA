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
import { usernameKey } from '@/core/auth/usernameValidation';

export class UserRepositoryImpl implements IUserRepository {
  /**
   * Create a new user account. Username is the required primary identity;
   * email is an optional recovery hint stored locally only.
   */
  async createUser(username: string, masterPassword: string, email?: string): Promise<User> {
    // Check if username is already taken (case-insensitive via usernameLower index)
    const existingUser = await db.users.where('usernameLower').equals(usernameKey(username)).first();
    if (existingUser) {
      throw new Error('Username already taken');
    }

    // Hash the master password with Scrypt
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
    // S7: zeroize the transient raw key bytes once the encrypted copy exists.
    masterVaultKey.fill(0);

    const user: User = {
      id: crypto.randomUUID(),
      username,
      ...(email ? { email } : {}),
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

    const storedUser: StoredUser = {
      ...user,
      usernameLower: usernameKey(username),
      createdAt: user.createdAt.getTime(),
      lastLoginAt: user.lastLoginAt.getTime(),
    };

    await db.users.add(storedUser);

    return user;
  }

  /**
   * Authenticate user with username and master password.
   */
  async authenticateWithPassword(username: string, masterPassword: string): Promise<AuthSession> {
    const key = usernameKey(username);

    // Rate-limit check before the expensive Scrypt verification
    await checkRateLimit(key);

    // Find user by usernameLower index
    const storedUser = await db.users.where('usernameLower').equals(key).first();
    if (!storedUser) {
      await recordFailedAttempt(key);
      throw new Error('Invalid username or password');
    }

    // Verify master password
    const isValid = await verifyPassword(masterPassword, storedUser.hashedMasterPassword);
    if (!isValid) {
      await recordFailedAttempt(key);
      throw new Error('Invalid username or password');
    }

    // Auth succeeded — clear any accumulated attempt record
    await clearAttempts(key);

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

    // Import the raw master vault key as a CryptoKey.
    // S7: NON-extractable — the session vault key never leaves WebCrypto, and
    // the transient raw bytes are zeroized immediately after import.
    let resolvedVaultKey: CryptoKey;
    try {
      resolvedVaultKey = await crypto.subtle.importKey(
        'raw',
        masterVaultKeyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } finally {
      masterVaultKeyBytes.fill(0);
    }

    // Update last login time
    await db.users.update(storedUser.id, {
      lastLoginAt: Date.now(),
    });

    // Seal any pre-v5 credentials that still carry plaintext metadata (S5).
    try {
      await sealLegacyMetadata(resolvedVaultKey);
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

    return {
      userId: storedUser.id,
      vaultKey: resolvedVaultKey,
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

    // S1: only PRF-scheme credentials can unlock the vault.
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

    const prfSaltBytes = decodeBase64ToUint8Array(credential.prfSalt);
    const { prfOutput, counter: newCounter } = await getPRFOutput(
      credentialId,
      prfSaltBytes,
      rpId,
      credential.counter,
    );

    let vaultKey: CryptoKey;
    try {
      vaultKey = await unwrapVaultKeyWithPRF(credential.wrappedVaultKey, prfOutput);
    } finally {
      // S7: the PRF output is key material — zeroize once the unwrap is done.
      prfOutput.fill(0);
    }

    const updatedCredentials = user.webAuthnCredentials.map(c =>
      c.id === credentialId
        ? { ...c, counter: newCounter, lastUsedAt: new Date() }
        : c
    );

    await db.users.update(userId, {
      webAuthnCredentials: updatedCredentials,
      lastLoginAt: Date.now(),
    });

    try {
      await sealLegacyMetadata(vaultKey);
    } catch {
      // Non-fatal: user is already authenticated; sealing will retry next login.
    }

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
   * Find user by username (case-insensitive)
   */
  async findByUsername(username: string): Promise<User | null> {
    const storedUser = await db.users.where('usernameLower').equals(usernameKey(username)).first();
    if (!storedUser) {
      return null;
    }

    return this.mapStoredUserToUser(storedUser);
  }

  /**
   * Find user by email (kept for backwards compatibility with pre-v7 lookup paths)
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
   * Register biometric credential.
   *
   * S7: takes the MASTER PASSWORD (not the session CryptoKey). The raw vault
   * key bytes are recovered by decrypting the stored encryptedVaultKey, wrapped
   * with the PRF-derived key, and zeroized — so the in-memory session vault key
   * can remain non-extractable. This mirrors how Bitwarden gates biometric
   * enrollment behind a master-password confirmation.
   */
  async registerBiometric(userId: string, masterPassword: string, deviceName?: string): Promise<void> {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Confirm the master password before touching key material.
    const passwordValid = await verifyPassword(masterPassword, user.hashedMasterPassword);
    if (!passwordValid) {
      throw new Error('Incorrect master password');
    }

    const { isBiometricAvailable, isPRFSupported, registerCredentialWithPRF, getPRFOutput } =
      await import('@/core/auth/webauthn');

    const available = await isBiometricAvailable();
    if (!available) {
      throw new Error('Biometric authentication is not available on this device');
    }

    // S1: biometric unlock REQUIRES the WebAuthn PRF extension.
    const prfSupported = await isPRFSupported();
    if (!prfSupported) {
      throw new Error('This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.');
    }

    const rpId = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'localhost'
      : window.location.hostname;

    const registration = await registerCredentialWithPRF({
      rpName: 'TrustVault',
      rpId,
      userId: user.id,
      userName: user.username ?? user.id,
      userDisplayName: user.displayName ?? user.username ?? user.id,
    });

    if (!registration.prfEnabled) {
      throw new Error('Your authenticator did not enable the PRF extension required for secure biometric unlock. Please use your master password.');
    }

    const { generatePrfSalt, wrapVaultKeyWithPRF } = await import('@/core/auth/biometricVaultKey');
    const prfSalt = generatePrfSalt();
    // Encode the salt for storage BEFORE the PRF ceremony — prfOutput buffers
    // are zeroized below and must never alias into what gets persisted.
    const prfSaltB64 = encodeUint8ArrayToBase64(prfSalt);
    const { prfOutput } = await getPRFOutput(registration.credentialId, prfSalt, rpId);

    // Recover the raw vault key bytes from storage using the master password,
    // wrap them under the PRF-derived key, then zeroize all transient material.
    const userSalt = Uint8Array.from(atob(user.salt), c => c.charCodeAt(0));
    const tempKey = await deriveKeyFromPassword(masterPassword, userSalt);
    const vaultKeyBase64 = await decrypt(
      JSON.parse(user.encryptedVaultKey) as Parameters<typeof decrypt>[0],
      tempKey,
    );
    const vaultKeyRaw = Uint8Array.from(atob(vaultKeyBase64), c => c.charCodeAt(0));

    let wrappedVaultKey: string;
    try {
      wrappedVaultKey = await wrapVaultKeyWithPRF(vaultKeyRaw, prfOutput);
    } finally {
      vaultKeyRaw.fill(0);
      prfOutput.fill(0);
    }

    const newCredential = {
      id: registration.credentialId,
      publicKey: registration.publicKey,
      counter: 0,
      transports: registration.transports,
      createdAt: new Date(),
      deviceName: deviceName ?? 'Biometric Device',
      vaultKeyScheme: 'prf-v1' as const,
      wrappedVaultKey,
      prfSalt: prfSaltB64,
    };

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

    const updatedCredentials = user.webAuthnCredentials.filter(c => c.id !== credentialId);
    const biometricEnabled = updatedCredentials.length > 0;

    await db.users.update(userId, {
      webAuthnCredentials: updatedCredentials,
      biometricEnabled,
    });
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

  async getSession(): Promise<AuthSession | null> {
    return null;
  }

  async lockSession(): Promise<void> {
    // Handled by authStore
  }

  async unlockSession(_vaultKey: CryptoKey): Promise<void> {
    // Handled by authStore
  }

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

    const isValid = await verifyPassword(currentPassword, user.hashedMasterPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const newHashedPassword = await hashPassword(newPassword);

    const currentSalt = Uint8Array.from(atob(user.salt), c => c.charCodeAt(0));
    const currentVaultKey = await deriveKeyFromPassword(currentPassword, currentSalt);

    const encryptedVaultKeyData = JSON.parse(user.encryptedVaultKey);
    const masterVaultKey = await decrypt(encryptedVaultKeyData, currentVaultKey);

    const newSalt = new Uint8Array(32);
    crypto.getRandomValues(newSalt);
    const newVaultKey = await deriveKeyFromPassword(newPassword, newSalt);
    const newEncryptedVaultKey = await encrypt(masterVaultKey, newVaultKey);

    await db.users.update(userId, {
      hashedMasterPassword: newHashedPassword,
      salt: btoa(String.fromCharCode(...newSalt)),
      encryptedVaultKey: JSON.stringify(newEncryptedVaultKey),
    });
  }

  async getLastLoginTime(userId: string): Promise<Date | null> {
    const user = await db.users.get(userId);
    if (!user) {
      return null;
    }

    return new Date(user.lastLoginAt);
  }

  async getUsersWithBiometric(): Promise<User[]> {
    const allUsers = await db.users.toArray();
    const users = allUsers.filter(user => user.biometricEnabled);
    return users.map(this.mapStoredUserToUser);
  }

  async getFirstBiometricCredential(userId: string): Promise<string | null> {
    const user = await db.users.get(userId);
    if (!user || !user.biometricEnabled || user.webAuthnCredentials.length === 0) {
      return null;
    }
    return user.webAuthnCredentials[0]?.id ?? null;
  }

  private mapStoredUserToUser(storedUser: StoredUser): User {
    return {
      ...storedUser,
      createdAt: new Date(storedUser.createdAt),
      lastLoginAt: new Date(storedUser.lastLoginAt),
    };
  }
}

export const userRepository = new UserRepositoryImpl();
