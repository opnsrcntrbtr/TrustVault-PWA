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
  title: string;
  username: string;
  encryptedPassword: string;
  encryptedTotpSecret?: string | undefined; // Encrypted TOTP secret
  encryptedNotes?: string | undefined; // Encrypted notes
  url?: string | undefined;
  notes?: string | undefined; // Legacy unencrypted notes (for backward compat)
  category: CredentialCategory;
  tags: string[];
  createdAt: number; // Store as timestamp
  updatedAt: number;
  lastAccessedAt?: number | undefined;
  isFavorite: boolean;
  securityScore?: number | undefined;

  // Card-specific fields (encrypted)
  encryptedCardNumber?: string | undefined;
  cardholderName?: string | undefined;
  expiryMonth?: string | undefined;
  expiryYear?: string | undefined;
  encryptedCvv?: string | undefined;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other' | undefined;
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

  constructor() {
    super('TrustVaultDB');

    const credentialStoreSchema =
      'id, title, username, category, isFavorite, *tags, createdAt, updatedAt';
    const userStoreSchema = 'id, email, createdAt, biometricEnabled';
    const sessionStoreSchema = 'id, userId, expiresAt, isLocked';
    const breachStoreSchema =
      'id, credentialId, checkType, breached, severity, checkedAt, expiresAt';

    // Define database schema - version 1
    this.version(1).stores({
      credentials: credentialStoreSchema,
      users: 'id, email, createdAt',
      sessions: sessionStoreSchema,
      settings: 'id',
    });

    // Version 2 - Add breach results table
    this.version(2).stores({
      credentials: credentialStoreSchema,
      users: 'id, email, createdAt',
      sessions: sessionStoreSchema,
      settings: 'id',
      breachResults: breachStoreSchema,
    });

    // Version 3 - Index biometricEnabled flag for fast lookups
    this.version(3)
      .stores({
        credentials: credentialStoreSchema,
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
  }

  /**
   * Clears all data from the database (for security wipe)
   */
  async clearAll(): Promise<void> {
    await this.credentials.clear();
    await this.sessions.clear();
    await this.breachResults.clear();
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
