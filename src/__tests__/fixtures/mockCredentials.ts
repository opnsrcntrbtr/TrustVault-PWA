import type { Credential, StoredCredential } from '@/domain/entities';


export const mockCredentialData: Partial<Credential> = {
  id: 'cred-1',
  username: 'john.doe',
  email: 'john@example.com',
  password: 'SecurePassword123!',
  url: 'https://example.com',
  notes: 'Main account',
  category: 'banking',
};

export const mockStoredCredential: StoredCredential = {
  id: 'cred-1',
  userId: 'user-1',
  profileId: 'personal', // Default profile
  username: 'john.doe',
  email: 'john@example.com',
  passwordEncrypted: 'base64-encrypted-password',
  urlEncrypted: 'base64-encrypted-url',
  notesEncrypted: 'base64-encrypted-notes',
  category: 'banking',
  tags: ['work', 'important'],
  metadata: { customField: 'value' },
  metadataEncrypted: 'base64-encrypted-metadata', // S5 sealed
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

export const createMockCredential = (overrides?: Partial<Credential>): Credential => ({
  ...mockCredentialData,
  ...overrides,
} as Credential);

export const createMockStoredCredential = (overrides?: Partial<StoredCredential>): StoredCredential => ({
  ...mockStoredCredential,
  ...overrides,
});
