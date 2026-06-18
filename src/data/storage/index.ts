// Public API — Safe for external use
export { db, initializeDatabase, TrustVaultDB } from './database';
export { debugUtils } from './debugUtils';

// Types
export type {
  StoredUser,
  StoredCredential,
  StoredBreachPrefix,
  StoredBreachResult,
  StoredLoginAttempt,
  VaultProfile,
} from './database';
