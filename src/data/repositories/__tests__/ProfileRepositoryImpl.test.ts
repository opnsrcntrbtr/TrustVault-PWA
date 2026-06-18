import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { profileRepository } from '@/data/repositories/ProfileRepositoryImpl';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

describe('ProfileRepositoryImpl', () => {
  let keyA: CryptoKey;
  const userA = 'user-a';

  beforeEach(async () => {
    await db.vaultProfiles.clear();
    await db.credentials.clear();
    keyA = await makeKey();
  });

  it('creates and finds a profile, name decrypted', async () => {
    const created = await profileRepository.create(
      { name: 'Work', type: 'work' },
      keyA,
      userA
    );
    expect(created.name).toBe('Work');

    const found = await profileRepository.findById(created.id, keyA, userA);
    expect(found?.name).toBe('Work');
  });

  it('findAll returns only the requesting user\'s profiles', async () => {
    const userB = 'user-b';
    const keyB = await makeKey();
    await profileRepository.create({ name: 'Personal', type: 'personal' }, keyA, userA);
    await profileRepository.create({ name: 'Secret', type: 'custom' }, keyB, userB);

    const all = await profileRepository.findAll(keyA, userA);
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe('Personal');
  });

  it('creating a second isDefault profile unsets the previous default', async () => {
    const first = await profileRepository.create(
      { name: 'Personal', type: 'personal', isDefault: true },
      keyA,
      userA
    );
    const second = await profileRepository.create(
      { name: 'Work', type: 'work', isDefault: true },
      keyA,
      userA
    );

    const refreshedFirst = await profileRepository.findById(first.id, keyA, userA);
    expect(refreshedFirst?.isDefault).toBe(false);
    expect(second.isDefault).toBe(true);
  });

  it('update re-encrypts the name', async () => {
    const created = await profileRepository.create({ name: 'Work', type: 'work' }, keyA, userA);
    const updated = await profileRepository.update(created.id, { name: 'Job' }, keyA, userA);
    expect(updated.name).toBe('Job');

    const row = await db.vaultProfiles.get(created.id);
    expect(row?.encryptedName).not.toContain('Job');
  });

  it('setDefault flips isDefault across the user\'s profiles', async () => {
    const a = await profileRepository.create(
      { name: 'Personal', type: 'personal', isDefault: true },
      keyA,
      userA
    );
    const b = await profileRepository.create({ name: 'Work', type: 'work' }, keyA, userA);

    await profileRepository.setDefault(b.id, userA);

    expect((await profileRepository.findById(a.id, keyA, userA))?.isDefault).toBe(false);
    expect((await profileRepository.findById(b.id, keyA, userA))?.isDefault).toBe(true);
  });

  it('getDefault returns the user\'s default profile', async () => {
    await profileRepository.create({ name: 'Personal', type: 'personal', isDefault: true }, keyA, userA);
    const def = await profileRepository.getDefault(keyA, userA);
    expect(def?.name).toBe('Personal');
  });

  it('delete removes the profile and its credentials', async () => {
    const profile = await profileRepository.create({ name: 'Work', type: 'work' }, keyA, userA);
    const cred = await credentialRepository.create(
      { title: 'X', username: 'u', password: 'p', category: 'login', tags: [] },
      keyA,
      userA
    );
    await db.credentials.update(cred.id, { profileId: profile.id });

    await profileRepository.delete(profile.id, keyA, userA);

    expect(await db.vaultProfiles.get(profile.id)).toBeUndefined();
    expect(await db.credentials.get(cred.id)).toBeUndefined();
  });

  it('deleting the only profile recreates a default "Personal" profile', async () => {
    const profile = await profileRepository.create(
      { name: 'Personal', type: 'personal', isDefault: true },
      keyA,
      userA
    );

    await profileRepository.delete(profile.id, keyA, userA);

    const remaining = await profileRepository.findAll(keyA, userA);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.name).toBe('Personal');
    expect(remaining[0]?.isDefault).toBe(true);
  });

  it('cannot find, update, or delete another user\'s profile', async () => {
    const userB = 'user-b';
    const keyB = await makeKey();
    const profile = await profileRepository.create({ name: 'Work', type: 'work' }, keyA, userA);

    expect(await profileRepository.findById(profile.id, keyB, userB)).toBeNull();
    await expect(
      profileRepository.update(profile.id, { name: 'Hacked' }, keyB, userB)
    ).rejects.toThrow();
    await expect(profileRepository.delete(profile.id, keyB, userB)).rejects.toThrow();
  });
});
