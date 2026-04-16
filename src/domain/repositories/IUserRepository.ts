/**
 * Domain Repository Interface: UserRepository
 * Defines contract for user authentication and management
 */
import { User, AuthSession, SecuritySettings } from '../entities/User';

export interface IUserRepository {
  // Authentication
  createUser(email: string, masterPassword: string): Promise<User>;
  authenticateWithPassword(email: string, masterPassword: string): Promise<AuthSession>;
  authenticateWithBiometric(userId: string, credentialId: string): Promise<AuthSession>;
  
  // User management
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateSecuritySettings(userId: string, settings: Partial<SecuritySettings>): Promise<void>;
  
  // WebAuthn
  registerBiometric(userId: string, vaultKey: CryptoKey, deviceName?: string): Promise<void>;
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
