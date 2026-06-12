/**
 * Two-user isolation invariant (audit 2026-06-11, Finding 1): one unlocked
 * user must not be able to enumerate, read, modify, or delete another user's
 * credential rows, even sharing the same browser-profile IndexedDB.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { sealLegacyMetadata } from '@/data/repositories/metadataSealing';

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
    await expect(credentialRepository.delete(a.id, keyB, userB)).rejects.toThrow();
    expect(await credentialRepository.findById(a.id, keyA, userA)).not.toBeNull();
  });

  it("delete refuses to remove an unowned legacy row when the caller's key cannot decrypt it", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v9 row: strip ownership.
    await db.credentials.update(a.id, { userId: undefined });

    // B cannot prove ownership → same error as "missing" (no existence oracle).
    await expect(credentialRepository.delete(a.id, keyB, userB)).rejects.toThrow(
      'Credential not found'
    );

    // Row must still exist and remain unowned.
    const row = await db.credentials.get(a.id);
    expect(row).toBeDefined();
    expect(row?.userId).toBeUndefined();
  });

  it('delete allows the rightful owner to remove an unowned legacy row with the correct key', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v9 row: strip ownership.
    await db.credentials.update(a.id, { userId: undefined });

    await credentialRepository.delete(a.id, keyA, userA);
    expect(await db.credentials.get(a.id)).toBeUndefined();
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

  it("sealLegacyMetadata must not seal an unowned legacy row with another user's key", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v5/pre-v9 row: plaintext metadata, unsealed, unowned.
    await db.credentials.update(a.id, {
      isSealed: false,
      title: 'Legacy plaintext title',
      encryptedTitle: undefined,
      userId: undefined,
    });

    // B's login pass must skip the row (B's key cannot decrypt it); sealing
    // it with keyB would permanently corrupt it for its rightful owner.
    expect(await sealLegacyMetadata(keyB, userB)).toBe(0);
    const afterB = await db.credentials.get(a.id);
    expect(afterB?.isSealed).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy plaintext column under test
    expect(afterB?.title).toBe('Legacy plaintext title');
    expect(afterB?.userId).toBeUndefined();

    // A's login pass seals it (decryption proof) and claims ownership.
    expect(await sealLegacyMetadata(keyA, userA)).toBe(1);
    const afterA = await db.credentials.get(a.id);
    expect(afterA?.isSealed).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy plaintext column under test
    expect(afterA?.title).toBeUndefined();
    expect(afterA?.encryptedTitle).toBeDefined();
    expect(afterA?.userId).toBe(userA);
  });

  it("sealLegacyMetadata only seals rows owned by the calling user", async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    const b = await credentialRepository.create(loginInput('B1'), keyB, userB);
    // Both rows unsealed with plaintext metadata, but both owned.
    await db.credentials.update(a.id, { isSealed: false, title: 'A plain', encryptedTitle: undefined });
    await db.credentials.update(b.id, { isSealed: false, title: 'B plain', encryptedTitle: undefined });

    expect(await sealLegacyMetadata(keyA, userA)).toBe(1);
    expect((await db.credentials.get(a.id))?.isSealed).toBe(true);
    expect((await db.credentials.get(b.id))?.isSealed).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy plaintext column under test
    expect((await db.credentials.get(b.id))?.title).toBe('B plain');
  });
});
