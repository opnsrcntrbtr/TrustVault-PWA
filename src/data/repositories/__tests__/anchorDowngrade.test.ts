import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { sealLegacyMetadata } from '../metadataSealing';
import { resealToAadV2 } from '../aadMigration';
import { isV2Row, openRow } from '../credentialRowCrypto';
import { db, type StoredCredential } from '../../storage/database';
import { encrypt, generateEncryptionKey } from '@/core/crypto/encryption';

const hooks = vi.hoisted(() => ({ delayNextReseal: 0 }));
vi.mock('../credentialRowCrypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../credentialRowCrypto')>();
  return {
    ...actual,
    resealRow: async (...args: Parameters<typeof actual.resealRow>) => {
      const delay = hooks.delayNextReseal;
      hooks.delayNextReseal = 0;
      const result = await actual.resealRow(...args);
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return result;
    },
  };
});

const repo = new CredentialRepository();
const USER = 'user-1';
let key: CryptoKey;
const login = { title: 'Bank', username: 'alice', password: 'real-pw', url: 'https://bank.example', category: 'login' as const, tags: [] };
const stored = async (id: string) => (await db.credentials.get(id)) as StoredCredential;
const planted = (id: string, extra: Partial<StoredCredential>): StoredCredential => ({
  id, userId: USER, category: 'login', isFavorite: false, createdAt: 1, updatedAt: 1, tags: [], encryptedPassword: 'x', ...extra,
});

beforeAll(async () => { key = await generateEncryptionKey(); });
beforeEach(async () => { hooks.delayNextReseal = 0; await db.credentials.clear(); });

describe('downgrading the row anchor', () => {
  it.each(['{}', 'x', '{"ciphertext":"AAAA","iv":"AAAAAAAAAAAAAAAA"}'])(
    'shows no plaintext columns when the password blob is replaced with %s',
    async (anchor) => {
      const { id } = await repo.create(login, key, USER);
      await db.credentials.update(id, {
        encryptedPassword: anchor, encryptedTitle: undefined, encryptedUsername: undefined, encryptedUrl: undefined,
        title: 'Bank', username: 'alice', url: 'https://evil.example', notes: 'call support at evil',
      });
      const read = await repo.findById(id, key, USER);
      expect(read).toMatchObject({ integrityError: true, title: 'Integrity check failed', username: '', password: '' });
      expect(read?.url).toBeUndefined();
      expect(read?.notes).toBeUndefined();
    }
  );

  it('does not encrypt planted plaintext for a row whose password the key cannot open, even if it claims the user', async () => {
    await db.credentials.add(planted('oracle', { isSealed: false, title: 'attacker-chosen' }));
    const before = await stored('oracle');
    await expect(sealLegacyMetadata(key, USER)).resolves.toBe(0);
    expect(await stored('oracle')).toEqual(before);
  });

  it('seals a genuine pre-v5 row straight to v2, so sealing never mints legacy blobs', async () => {
    await db.credentials.add(planted('old', {
      encryptedPassword: JSON.stringify(await encrypt('old-pw', key)), title: 'Old', url: 'https://old.example',
    }));
    await expect(sealLegacyMetadata(key, USER)).resolves.toBe(1);
    const row = await stored('old');
    expect(isV2Row(row)).toBe(true);
    expect(row.title).toBeUndefined();
    await expect(openRow(row, key, USER)).resolves.toEqual({
      encryptedPassword: 'old-pw', encryptedTitle: 'Old', encryptedUrl: 'https://old.example',
    });
    await expect(resealToAadV2(key, USER)).resolves.toEqual({ upgraded: 0, skipped: 0 });
  });
});

describe('concurrent updates to a legacy row', () => {
  it('a slow favourite toggle does not undo a password change', async () => {
    const blob = async (v: string) => JSON.stringify(await encrypt(v, key));
    await db.credentials.add(planted('legacy', {
      isSealed: true, encryptedPassword: await blob('old-pw'), encryptedTitle: await blob('Old'),
    }));
    hooks.delayNextReseal = 80;
    await Promise.all([
      repo.update('legacy', { isFavorite: true }, key, USER),
      repo.update('legacy', { password: 'new-pw' }, key, USER),
    ]);
    await expect(repo.findById('legacy', key, USER)).resolves.toMatchObject({ password: 'new-pw', isFavorite: true });
  });
});
