/**
 * Domain Repository Interface: UserRepository
 * Defines contract for user authentication and management
 */
import { User, AuthSession, SecuritySettings } from '../entities/User';

export interface IUserRepository {
  // Authentication
  createUser(username: string, masterPassword: string, email?: string): Promise<User>;
  authenticateWithPassword(username: string, masterPassword: string): Promise<AuthSession>;
  authenticateWithBiometric(userId: string, credentialId: string): Promise<AuthSession>;

  // User management
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateSecuritySettings(userId: string, settings: Partial<SecuritySettings>): Promise<void>;

  // WebAuthn
  // S7: enrollment confirms the master password and recovers the vault key
  // from storage, so the in-memory session key can stay non-extractable.
  registerBiometric(userId: string, masterPassword: string, deviceName?: string): Promise<void>;
  removeBiometric(userId: string, credentialId: string): Promise<void>;

  // Session management
  createSession(userId: string, vaultKey: CryptoKey): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  lockSession(): Promise<void>;
  unlockSession(vaultKey: CryptoKey): Promise<void>;
  destroySession(): Promise<void>;

  // Security
  changeMasterPassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  getLastLoginTime(userId: string): Promise<Date | null>;
}
