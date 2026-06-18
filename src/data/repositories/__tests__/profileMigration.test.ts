/**
 * v10 post-login migration (Phase 7 — multi-vault profiles): the Dexie
 * .version(10) upgrade adds the schema (table + index) only, since it
 * cannot encrypt the default profile's name without the vault key (same
 * constraint as v5/S5 metadata sealing). ensureDefaultProfile() does the
 * actual row creation + backfill, called post-login like sealLegacyMetadata().
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { ensureDefaultProfile } from '@/data/repositories/profileMigration';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { decrypt } from '@/core/crypto/encryption';

async function makeVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const loginInput = (title: string) => ({
  title,
  username: 'user@example.com',
  password: 'secret-password-123',
  category: 'login' as const,
  tags: [],
});

describe('ensureDefaultProfile (v10 post-login migration)', () => {
  let keyA: CryptoKey;
  const userA = 'user-a-id';

  beforeEach(async () => {
    await db.credentials.clear();
    await db.vaultProfiles.clear();
    keyA = await makeVaultKey();
  });

  it('creates a default "Personal" profile for a user with none', async () => {
    const profile = await ensureDefaultProfile(keyA, userA);

    expect(profile.name).toBe('Personal');
    expect(profile.type).toBe('personal');
    expect(profile.isDefault).toBe(true);

    const rows = await db.vaultProfiles.where('userId').equals(userA).toArray();
    expect(rows).toHaveLength(1);
  });

  it('stores the profile name encrypted at rest', async () => {
    await ensureDefaultProfile(keyA, userA);

    const [row] = await db.vaultProfiles.where('userId').equals(userA).toArray();
    expect(row?.encryptedName).toBeDefined();
    expect(row?.encryptedName).not.toContain('Personal');

    expect(row).toBeDefined();
    const decrypted = await decrypt(
      JSON.parse(row?.encryptedName ?? '') as Parameters<typeof decrypt>[0],
      keyA
    );
    expect(decrypted).toBe('Personal');
  });

  it('backfills profileId on existing credentials lacking one', async () => {
    const cred = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v10 row (no profileId).
    await db.credentials.update(cred.id, { profileId: undefined });

    const profile = await ensureDefaultProfile(keyA, userA);

    const row = await db.credentials.get(cred.id);
    expect(row?.profileId).toBe(profile.id);
  });

  it('is idempotent — running twice does not create a second profile', async () => {
    const first = await ensureDefaultProfile(keyA, userA);
    const second = await ensureDefaultProfile(keyA, userA);

    expect(second.id).toBe(first.id);
    const rows = await db.vaultProfiles.where('userId').equals(userA).toArray();
    expect(rows).toHaveLength(1);
  });

  it('does not touch another user\'s credentials', async () => {
    const userB = 'user-b-id';
    const keyB = await makeVaultKey();
    const credB = await credentialRepository.create(loginInput('B1'), keyB, userB);
    await db.credentials.update(credB.id, { profileId: undefined });

    await ensureDefaultProfile(keyA, userA);

    const rowB = await db.credentials.get(credB.id);
    expect(rowB?.profileId).toBeUndefined();
  });
});
