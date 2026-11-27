import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resealToAadV2 } from '../aadMigration';
import { openRow, isV2Row } from '../credentialRowCrypto';
import { ensureDefaultProfile } from '../profileMigration';
import { profileRepository } from '../ProfileRepositoryImpl';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { db, type StoredCredential, type StoredVaultProfile } from '../../storage/database';
import { encrypt, decrypt, deriveKeyFromPassword, deriveVaultWrapKey, generateEncryptionKey, type EncryptedData } from '@/core/crypto/encryption';
import { buildAad } from '@/core/crypto/aad';

// Lets a test run code between "row read" and "row written".
const hooks = vi.hoisted(() => ({ afterReseal: null as null | (() => Promise<void>) }));
vi.mock('../credentialRowCrypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../credentialRowCrypto')>();
  return {
    ...actual,
    resealRow: async (...args: Parameters<typeof actual.resealRow>) => {
      const result = await actual.resealRow(...args);
      await hooks.afterReseal?.();
      return result;
    },
  };
});

const USER = 'user-1';
let key: CryptoKey;
const blob = async (value: string, k = key) => JSON.stringify(await encrypt(value, k));
const CORRUPT = '{"ciphertext":"AAAA","iv":"AAAAAAAAAAAAAAAA"}';

async function addRow(id: string, extra: Partial<StoredCredential> = {}): Promise<void> {
  await db.credentials.add({
    id, userId: USER, category: 'login', isFavorite: false, createdAt: 1, updatedAt: 111, isSealed: true, tags: [],
    encryptedPassword: await blob(`pw-${id}`), encryptedTitle: await blob(`title-${id}`),
    ...extra,
  });
}
const row = async (id: string) => (await db.credentials.get(id)) as StoredCredential;

async function addProfile(id: string, name: string): Promise<void> {
  await db.vaultProfiles.add({ id, userId: USER, encryptedName: await blob(name), type: 'personal', isDefault: false, createdAt: 1, updatedAt: 222 });
}

beforeEach(async () => {
  hooks.afterReseal = null;
  await Promise.all([db.credentials.clear(), db.vaultProfiles.clear(), db.users.clear()]);
  key = await generateEncryptionKey();
});

describe('resealToAadV2', () => {
  it('upgrades sparse legacy rows without changing plaintext or updatedAt, once', async () => {
    await addRow('a', { encryptedUrl: await blob('https://a.example') });
    await addRow('sparse');
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 2, skipped: 0 });
    for (const id of ['a', 'sparse']) {
      const r = await row(id);
      expect(isV2Row(r)).toBe(true);
      expect(r.updatedAt).toBe(111);
    }
    await expect(openRow(await row('a'), key, USER)).resolves.toEqual({
      encryptedPassword: 'pw-a', encryptedTitle: 'title-a', encryptedUrl: 'https://a.example',
    });
    await expect(openRow(await row('sparse'), key, USER)).resolves.toEqual({
      encryptedPassword: 'pw-sparse', encryptedTitle: 'title-sparse',
    });
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 0, skipped: 0 });
  });

  it('leaves a row with a corrupt column byte-identical and upgrades the rest', async () => {
    await addRow('good');
    await addRow('bad', { encryptedNotes: CORRUPT });
    const before = await row('bad');
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 1, skipped: 1 });
    expect(await row('bad')).toEqual(before);
    expect(isV2Row(await row('good'))).toBe(true);
  });

  it('does not overwrite a row edited while it was being upgraded', async () => {
    await addRow('a');
    const edited = await blob('edited-password');
    hooks.afterReseal = async () => { await db.credentials.update('a', { encryptedPassword: edited, updatedAt: 999 }); };
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 0, skipped: 1 });
    expect((await row('a')).encryptedPassword).toBe(edited);
  });

  it('ignores other users and unsealed rows, and claims unowned rows it can decrypt', async () => {
    const otherKey = await generateEncryptionKey();
    await addRow('other', { userId: 'user-2', encryptedPassword: await blob('x', otherKey) });
    await addRow('unsealed', { isSealed: false, title: 'plain' });
    await addRow('mine-unowned', { userId: undefined });
    await addRow('foreign-unowned', { userId: undefined, encryptedPassword: await blob('x', otherKey) });
    const before = await Promise.all(['other', 'unsealed', 'foreign-unowned'].map(row));
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 1, skipped: 0 });
    expect(await Promise.all(['other', 'unsealed', 'foreign-unowned'].map(row))).toEqual(before);
    expect((await row('mine-unowned')).userId).toBe(USER);
  });

  it('upgrades profile names, which the profile repository still reads', async () => {
    await addProfile('p1', 'Work');
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 1, skipped: 0 });
    const stored = (await db.vaultProfiles.get('p1')) as StoredVaultProfile;
    expect((JSON.parse(stored.encryptedName) as EncryptedData).v).toBe(2);
    expect(stored.updatedAt).toBe(222);
    await expect(profileRepository.findById('p1', key, USER)).resolves.toMatchObject({ name: 'Work' });
  });

  it('rejects a profile name moved to another profile', async () => {
    const a = await profileRepository.create({ name: 'Work', type: 'work' }, key, USER);
    const b = await profileRepository.create({ name: 'Home', type: 'personal' }, key, USER);
    const stolen = (await db.vaultProfiles.get(a.id))!.encryptedName;
    await db.vaultProfiles.update(b.id, { encryptedName: stolen });
    await expect(profileRepository.findById(b.id, key, USER)).rejects.toThrow('Failed to decrypt data');
  });

  it('writes the default profile name as v2', async () => {
    const profile = await ensureDefaultProfile(key, USER);
    const stored = (await db.vaultProfiles.get(profile.id))!;
    expect((JSON.parse(stored.encryptedName) as EncryptedData).v).toBe(2);
    expect(profile.name).toBe('Personal');
  });
});

describe('vault-key wrap binding', () => {
  const repo = new UserRepositoryImpl();
  const PASSWORD = 'TestPassword123!';
  const wrapOf = async (id: string) => JSON.parse((await db.users.get(id))!.encryptedVaultKey) as EncryptedData;

  async function unwrap(userId: string, password: string): Promise<string> {
    const user = (await db.users.get(userId))!;
    const salt = Uint8Array.from(atob(user.salt), (c) => c.charCodeAt(0));
    return decrypt(await wrapOf(userId), await deriveVaultWrapKey(password, salt), buildAad({ purpose: 'vault-key-wrap', userId }));
  }

  /** Rewrites a user's wrap in the pre-AAD format and returns the raw vault key. */
  async function downgradeWrap(userId: string, kdf: 'pbkdf2' | 'scrypt-v1'): Promise<string> {
    const raw = await unwrap(userId, PASSWORD);
    const user = (await db.users.get(userId))!;
    const salt = Uint8Array.from(atob(user.salt), (c) => c.charCodeAt(0));
    const wrapKey = kdf === 'scrypt-v1' ? await deriveVaultWrapKey(PASSWORD, salt) : await deriveKeyFromPassword(PASSWORD, salt);
    await db.users.update(userId, {
      encryptedVaultKey: JSON.stringify(await encrypt(raw, wrapKey)),
      vaultKdf: kdf === 'scrypt-v1' ? 'scrypt-v1' : undefined,
    });
    return raw;
  }

  it('writes a v2 wrap at signup and password change', async () => {
    const user = await repo.createUser('wrapuser', PASSWORD);
    expect((await wrapOf(user.id)).v).toBe(2);
    const raw = await unwrap(user.id, PASSWORD);
    await repo.changeMasterPassword(user.id, PASSWORD, 'AnotherPassword456!');
    expect((await wrapOf(user.id)).v).toBe(2);
    await expect(unwrap(user.id, 'AnotherPassword456!')).resolves.toBe(raw);
  });

  it.each(['pbkdf2', 'scrypt-v1'] as const)('upgrades a legacy %s wrap on password login, keeping the vault key', async (kdf) => {
    const user = await repo.createUser(`legacy-${kdf}`, PASSWORD);
    const raw = await downgradeWrap(user.id, kdf);
    await repo.authenticateWithPassword(`legacy-${kdf}`, PASSWORD);
    expect((await wrapOf(user.id)).v).toBe(2);
    expect((await db.users.get(user.id))!.vaultKdf).toBe('scrypt-v1');
    await expect(unwrap(user.id, PASSWORD)).resolves.toBe(raw);
  });

  it('fails to unlock with a wrap moved from another user', async () => {
    const a = await repo.createUser('user-a', PASSWORD);
    const b = await repo.createUser('user-b', PASSWORD);
    const source = (await db.users.get(a.id))!;
    await db.users.update(b.id, { encryptedVaultKey: source.encryptedVaultKey, salt: source.salt });
    await expect(repo.authenticateWithPassword('user-b', PASSWORD)).rejects.toThrow();
  });

  it('upgrades legacy rows during password login', async () => {
    const user = await repo.createUser('rowuser', PASSWORD);
    const session = await repo.authenticateWithPassword('rowuser', PASSWORD);
    key = session.vaultKey;
    await addRow('legacy', { userId: user.id });
    await repo.authenticateWithPassword('rowuser', PASSWORD);
    expect(isV2Row(await row('legacy'))).toBe(true);
  });
});
