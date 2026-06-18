import type { User, AuthSession } from '@/domain/entities';
import type { StoredUser } from '@/data/storage/database';

export const mockUserData: Partial<User> = {
  id: 'user-1',
  email: 'john@example.com',
  username: 'johndoe',
  passwordHash: 'scrypt-hash-base64',
  passwordSalt: 'random-salt-base64',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

export const mockStoredUser: StoredUser = {
  id: 'user-1',
  email: 'john@example.com',
  username: 'johndoe',
  passwordHash: 'scrypt-hash-base64',
  passwordSalt: 'random-salt-base64',
  vaultKeyEncrypted: 'base64-encrypted-vault-key',
  vaultKeyScheme: 'prf-v1', // PRF-wrapped biometric
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

export const mockAuthSession: AuthSession = {
  userId: 'user-1',
  email: 'john@example.com',
  username: 'johndoe',
  isAuthenticated: true,
  lastAuthAt: new Date('2024-06-18'),
  sessionVaultKey: { type: 'CryptoKey', extractable: false } as CryptoKey,
};

export const createMockUser = (overrides?: Partial<User>): User => ({
  ...mockUserData,
  ...overrides,
} as User);

export const createMockStoredUser = (overrides?: Partial<StoredUser>): StoredUser => ({
  ...mockStoredUser,
  ...overrides,
});

export const createMockAuthSession = (overrides?: Partial<AuthSession>): AuthSession => ({
  ...mockAuthSession,
  ...overrides,
});
