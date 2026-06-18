/**
 * Phase 7 — multi-vault profiles: credential reads/writes can be scoped to
 * a profileId. Optional everywhere for backward compatibility — omitting it
 * preserves pre-Phase-7 behavior (all of the user's credentials).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const loginInput = (title: string) => ({
  title,
  username: 'u@example.com',
  password: 'secret-password-123',
  category: 'login' as const,
  tags: [],
});

describe('CredentialRepositoryImpl profile scoping', () => {
  let key: CryptoKey;
  const userId = 'user-1';
  const profileA = 'profile-a';
  const profileB = 'profile-b';

  beforeEach(async () => {
    await db.credentials.clear();
    key = await makeKey();
  });

  it('create() stamps the credential with the given profileId', async () => {
    const cred = await credentialRepository.create(loginInput('A1'), key, userId, profileA);
    const row = await db.credentials.get(cred.id);
    expect(row?.profileId).toBe(profileA);
  });

  it('findAll() with a profileId only returns that profile\'s credentials', async () => {
    await credentialRepository.create(loginInput('A1'), key, userId, profileA);
    await credentialRepository.create(loginInput('B1'), key, userId, profileB);

    const onlyA = await credentialRepository.findAll(key, userId, profileA);
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0]?.title).toBe('A1');
  });

  it('findAll() without a profileId returns all of the user\'s credentials', async () => {
    await credentialRepository.create(loginInput('A1'), key, userId, profileA);
    await credentialRepository.create(loginInput('B1'), key, userId, profileB);

    const all = await credentialRepository.findAll(key, userId);
    expect(all).toHaveLength(2);
  });

  it('findFavorites() respects profileId scoping', async () => {
    const a = await credentialRepository.create(loginInput('A1'), key, userId, profileA);
    await credentialRepository.update(a.id, { isFavorite: true }, key, userId);
    await credentialRepository.create({ ...loginInput('B1'), isFavorite: true }, key, userId, profileB);

    const favA = await credentialRepository.findFavorites(key, userId, profileA);
    expect(favA).toHaveLength(1);
    expect(favA[0]?.title).toBe('A1');
  });

  it('findByCategory() respects profileId scoping', async () => {
    await credentialRepository.create(loginInput('A1'), key, userId, profileA);
    await credentialRepository.create(loginInput('B1'), key, userId, profileB);

    const catA = await credentialRepository.findByCategory('login', key, userId, profileA);
    expect(catA).toHaveLength(1);
    expect(catA[0]?.title).toBe('A1');
  });

  it('search() respects profileId scoping', async () => {
    await credentialRepository.create(loginInput('Apple'), key, userId, profileA);
    await credentialRepository.create(loginInput('Apricot'), key, userId, profileB);

    const results = await credentialRepository.search('ap', key, userId, profileA);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Apple');
  });
});
