/**
 * Secure Storage Service using IndexedDB with Dexie
 * Implements encrypted credential storage with Dexie-encrypted
 * 
 * Features:
 * - Transparent encryption/decryption
 * - Offline-first storage
 * - Efficient indexing and querying
 * - Automatic versioning
 */

import Dexie, { type Table } from 'dexie';
import { User, SecuritySettings } from '@/domain/entities/User';

// Database schema interfaces
import type { CredentialCategory } from '@/domain/entities/Credential';

export interface StoredCredential {
  id: string;

  // ── Non-sensitive index fields (not user-identifying) ──────────────────────
  category: CredentialCategory; // kept for findByCategory() index
  isFavorite: boolean;          // kept for findFavorites() index
  createdAt: number;
  updatedAt: number;
  lastAccessedAt?: number | undefined;
  securityScore?: number | undefined;

  // ── Always-encrypted sensitive fields (v5+) ────────────────────────────────
  encryptedPassword: string;
  encryptedTitle?: string | undefined;    // AES-256-GCM encrypted title
  encryptedUsername?: string | undefined; // AES-256-GCM encrypted username
  encryptedUrl?: string | undefined;      // AES-256-GCM encrypted url
  encryptedTags?: string | undefined;     // AES-256-GCM encrypted JSON tag array
  encryptedNotes?: string | undefined;
  encryptedTotpSecret?: string | undefined;
  encryptedCardNumber?: string | undefined;
  encryptedCvv?: string | undefined;
  // Card fields newly encrypted in v5 (were plaintext before)
  encryptedCardholderName?: string | undefined;
  encryptedExpiryMonth?: string | undefined;
  encryptedExpiryYear?: string | undefined;
  encryptedCardType?: string | undefined;
  encryptedBillingAddress?: string | undefined;

  // ── Migration sentinel ─────────────────────────────────────────────────────
  /** true = all metadata fields are encrypted; absent/false = pre-v5 legacy record */
  isSealed?: boolean | undefined;

  // ── Legacy plaintext fields — present only on pre-v5 records ──────────────
  // These are cleared by sealLegacyMetadata() after encryption.
  // They remain in the type so Dexie can read and migrate old rows.
  /** @deprecated Use encryptedTitle instead */
  title?: string | undefined;
  /** @deprecated Use encryptedUsername instead */
  username?: string | undefined;
  /** @deprecated Use encryptedUrl instead */
  url?: string | undefined;
  /** @deprecated Use encryptedTags instead */
  tags?: string[] | undefined;
  /** @deprecated Legacy unencrypted notes */
  notes?: string | undefined;
  /** @deprecated Use encryptedCardholderName instead */
  cardholderName?: string | undefined;
  /** @deprecated Use encryptedExpiryMonth instead */
  expiryMonth?: string | undefined;
  /** @deprecated Use encryptedExpiryYear instead */
  expiryYear?: string | undefined;
  /** @deprecated Use encryptedCardType instead */
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other' | undefined;
  /** @deprecated Use encryptedBillingAddress instead */
  billingAddress?: string | undefined;
}

export interface StoredUser extends Omit<User, 'createdAt' | 'lastLoginAt'> {
  createdAt: number;
  lastLoginAt: number;
}

export interface StoredSession {
  id: string;
  userId: string;
  encryptedVaultKey: string; // Stored encrypted, decrypted in memory
  expiresAt: number;
  isLocked: boolean;
  createdAt: number;
}

export interface StoredBreachResult {
  id: string;
  credentialId: string;
  checkType: 'password' | 'email';
  breached: boolean;
  breachCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  breachNames: string[];
  breachData: string; // JSON stringified BreachData[] (empty string if no data)
  checkedAt: number;
  expiresAt: number;
}

export interface StoredLoginAttempt {
  email: string;        // primary key
  attempts: number;
  lockedUntil: number;  // epoch ms; 0 = not locked
  lastAttemptAt: number;
}

/**
 * TrustVault Database
 * Manages all local storage with encryption
 */
export class TrustVaultDB extends Dexie {
  credentials!: Table<StoredCredential, string>;
  users!: Table<StoredUser, string>;
  sessions!: Table<StoredSession, string>;
  settings!: Table<{ id: string; data: SecuritySettings }, string>;
  breachResults!: Table<StoredBreachResult, string>;
  loginAttempts!: Table<StoredLoginAttempt, string>;

  constructor() {
    super('TrustVaultDB');

    // v4 schema (kept for migration history — DO NOT USE for new code)
    const credentialStoreSchemaV4 =
      'id, title, username, category, isFavorite, *tags, createdAt, updatedAt';
    // v5 schema: title/username/tags removed from index (they are encrypted blobs now).
    // category + isFavorite remain for findByCategory() / findFavorites() queries.
    const credentialStoreSchema =
      'id, category, isFavorite, createdAt, updatedAt';
    const userStoreSchema = 'id, email, createdAt, biometricEnabled';
    const sessionStoreSchema = 'id, userId, expiresAt, isLocked';
    const breachStoreSchema =
      'id, credentialId, checkType, breached, severity, checkedAt, expiresAt';

    // Define database schema - version 1
    this.version(1).stores({
      credentials: credentialStoreSchemaV4,
      users: 'id, email, createdAt',
      sessions: sessionStoreSchema,
      settings: 'id',
    });

    // Version 2 - Add breach results table
    this.version(2).stores({
      credentials: credentialStoreSchemaV4,
      users: 'id, email, createdAt',
      sessions: sessionStoreSchema,
      settings: 'id',
      breachResults: breachStoreSchema,
    });

    // Version 3 - Index biometricEnabled flag for fast lookups
    this.version(3)
      .stores({
        credentials: credentialStoreSchemaV4,
        users: userStoreSchema,
        sessions: sessionStoreSchema,
        settings: 'id',
        breachResults: breachStoreSchema,
      })
      .upgrade(async (tx) => {
        // Ensure legacy entries have a boolean flag defined so the new index is populated
        await tx
          .table<StoredUser>('users')
          .toCollection()
          .modify((user) => {
            if (typeof user.biometricEnabled !== 'boolean') {
              user.biometricEnabled = Boolean(user.biometricEnabled);
            }
          });
    });

    // Version 4 - Add login attempts table for brute-force rate limiting
    this.version(4).stores({
      credentials: credentialStoreSchemaV4,
      users: userStoreSchema,
      sessions: sessionStoreSchema,
      settings: 'id',
      breachResults: breachStoreSchema,
      loginAttempts: 'email, lockedUntil',
    });

    // Version 5 - Metadata encryption (S5)
    // title/username/*tags indexes are dropped: they are now AES-256-GCM blobs.
    // Existing rows keep their plaintext fields; sealLegacyMetadata() (called
    // after every login) encrypts and clears them in the background.
    this.version(5).stores({
      credentials: credentialStoreSchema,
      users: userStoreSchema,
      sessions: sessionStoreSchema,
      settings: 'id',
      breachResults: breachStoreSchema,
      loginAttempts: 'email, lockedUntil',
    });
  }

  /**
   * Clears all data from the database (for security wipe)
   */
  async clearAll(): Promise<void> {
    await this.credentials.clear();
    await this.sessions.clear();
    await this.breachResults.clear();
    await this.loginAttempts.clear();
    // Keep users table for re-login
  }

  /**
   * Exports database to JSON (for backup)
   */
  async exportToJSON(): Promise<string> {
    const data = {
      credentials: await this.credentials.toArray(),
      users: await this.users.toArray(),
      settings: await this.settings.toArray(),
      exportedAt: Date.now(),
      version: this.verno,
    };

    return JSON.stringify(data);
  }

  /**
   * Imports database from JSON (for restore)
   */
  async importFromJSON(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData) as {
        credentials: StoredCredential[];
        users: StoredUser[];
        settings: { id: string; data: SecuritySettings }[];
      };

      await this.transaction('rw', this.credentials, this.users, this.settings, async () => {
        if (data.credentials && data.credentials.length > 0) {
          await this.credentials.bulkAdd(data.credentials);
        }
        if (data.users && data.users.length > 0) {
          await this.users.bulkAdd(data.users);
        }
        if (data.settings && data.settings.length > 0) {
          await this.settings.bulkAdd(data.settings);
        }
      });
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid backup data');
    }
  }

  /**
   * Gets database size information
   */
  async getDatabaseSize(): Promise<{
    credentials: number;
    users: number;
    sessions: number;
    breachResults: number;
  }> {
    return {
      credentials: await this.credentials.count(),
      users: await this.users.count(),
      sessions: await this.sessions.count(),
      breachResults: await this.breachResults.count(),
    };
  }
}

// Create singleton instance
export const db = new TrustVaultDB();

/**
 * Initializes the database
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Opening TrustVault database...');
    await db.open();
    console.log('TrustVault database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Don't throw - allow app to continue without persistence
    console.warn('App will continue without persistent storage');
  }
}

/**
 * Closes the database connection
 */
export function closeDatabase(): void {
  db.close();
}

/**
 * Deletes the entire database (for complete data wipe)
 */
export async function deleteDatabase(): Promise<void> {
  await db.delete();
  console.log('TrustVault database deleted');
}
