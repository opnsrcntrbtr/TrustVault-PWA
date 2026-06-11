/**
 * Two-user isolation invariant (audit 2026-06-11, Finding 1): one unlocked
 * user must not be able to enumerate, read, modify, or delete another user's
 * credential rows, even sharing the same browser-profile IndexedDB.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';

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

describe('two-user credential isolation', () => {
  let keyA: CryptoKey;
  let keyB: CryptoKey;
  const userA = 'user-a-id';
  const userB = 'user-b-id';

  beforeEach(async () => {
    await db.credentials.clear();
    keyA = await makeVaultKey();
    keyB = await makeVaultKey();
  });

  it("findAll returns only the calling user's credentials", async () => {
    await credentialRepository.create(loginInput('A1'), keyA, userA);
    await credentialRepository.create(loginInput('A2'), keyA, userA);
    await credentialRepository.create(loginInput('B1'), keyB, userB);

    const aRows = await credentialRepository.findAll(keyA, userA);
    const bRows = await credentialRepository.findAll(keyB, userB);

    expect(aRows.map((c) => c.title).sort()).toEqual(['A1', 'A2']);
    expect(bRows.map((c) => c.title)).toEqual(['B1']);
  });

  it("findById returns null for another user's credential", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    expect(await credentialRepository.findById(a.id, keyB, userB)).toBeNull();
  });

  it("update refuses to touch another user's credential", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    await expect(
      credentialRepository.update(a.id, { title: 'hijacked' }, keyB, userB)
    ).rejects.toThrow();
    const fresh = await credentialRepository.findById(a.id, keyA, userA);
    expect(fresh?.title).toBe('A1');
  });

  it("delete refuses to remove another user's credential", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    await expect(credentialRepository.delete(a.id, userB)).rejects.toThrow();
    expect(await credentialRepository.findById(a.id, keyA, userA)).not.toBeNull();
  });

  it('legacy unowned rows are lazily claimed only by the user whose key decrypts them', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v9 row: strip ownership.
    await db.credentials.update(a.id, { userId: undefined });

    // B's key cannot decrypt the row → B must not see or claim it.
    expect(await credentialRepository.findAll(keyB, userB)).toEqual([]);
    expect((await db.credentials.get(a.id))?.userId).toBeUndefined();

    // A's key decrypts it → A sees it and the row is claimed.
    const aRows = await credentialRepository.findAll(keyA, userA);
    expect(aRows.map((c) => c.title)).toEqual(['A1']);
    expect((await db.credentials.get(a.id))?.userId).toBe(userA);
  });
});
