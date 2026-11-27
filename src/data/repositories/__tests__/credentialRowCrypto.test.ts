import { describe, it, expect, beforeAll } from 'vitest';
import { IntegrityError, isV2Row, sealField, openRow, resealRow } from '../credentialRowCrypto';
import { encrypt, generateEncryptionKey } from '@/core/crypto/encryption';
import { buildAad, type CredentialField } from '@/core/crypto/aad';
import type { StoredCredential } from '@/data/storage/database';

let key: CryptoKey;
beforeAll(async () => { key = await generateEncryptionKey(); });

const base = { category: 'login' as const, isFavorite: false, createdAt: 1, updatedAt: 1, isSealed: true };
const legacy = async (value: string) => JSON.stringify(await encrypt(value, key));

async function v2Row(id: string, values: Partial<Record<CredentialField, string>>): Promise<StoredCredential> {
  const row: Record<string, unknown> = { ...base, id, userId: 'u1' };
  for (const [field, value] of Object.entries(values)) {
    row[field] = await sealField(value, key, 'u1', id, field as CredentialField);
  }
  return row as unknown as StoredCredential;
}

describe('credential row crypto', () => {
  it('round-trips a v2 row and omits absent columns', async () => {
    const row = await v2Row('r1', { encryptedPassword: 'pw', encryptedUrl: 'https://bank.example' });
    expect(isV2Row(row)).toBe(true);
    await expect(openRow(row, key, 'u1')).resolves.toEqual({
      encryptedPassword: 'pw', encryptedUrl: 'https://bank.example',
    });
  });

  it('treats legacy and unparsable password blobs as not v2', async () => {
    expect(isV2Row({ encryptedPassword: await legacy('pw') })).toBe(false);
    expect(isV2Row({ encryptedPassword: 'not json' })).toBe(false);
    expect(isV2Row({ encryptedPassword: 'null' })).toBe(false);
  });

  it('rejects password blobs swapped between records', async () => {
    const a = await v2Row('a', { encryptedPassword: 'pw-a' });
    const b = await v2Row('b', { encryptedPassword: 'pw-b' });
    await expect(openRow({ ...a, encryptedPassword: b.encryptedPassword }, key, 'u1')).rejects.toThrow(IntegrityError);
  });

  it('rejects a password blob copied into the url column', async () => {
    const row = await v2Row('r1', { encryptedPassword: 'pw' });
    await expect(openRow({ ...row, encryptedUrl: row.encryptedPassword }, key, 'u1')).rejects.toThrow(IntegrityError);
  });

  it('rejects a legacy column inside a v2 row', async () => {
    const row = await v2Row('r1', { encryptedPassword: 'pw' });
    await expect(openRow({ ...row, encryptedUrl: await legacy('https://evil.example') }, key, 'u1'))
      .rejects.toThrow('Integrity check failed');
  });

  it('rejects a legacy password blob', async () => {
    const row = { ...base, id: 'r1', userId: 'u1', encryptedPassword: await legacy('pw') };
    await expect(openRow(row, key, 'u1')).rejects.toThrow(IntegrityError);
  });

  it('rejects another userId', async () => {
    const row = await v2Row('r1', { encryptedPassword: 'pw' });
    await expect(openRow(row, key, 'u2')).rejects.toThrow(IntegrityError);
  });

  it('rejects a profile-name ciphertext placed in a column', async () => {
    const row = await v2Row('r1', { encryptedPassword: 'pw' });
    const name = JSON.stringify(await encrypt('Work', key, buildAad({ purpose: 'profile-name', userId: 'u1', recordId: 'r1' })));
    await expect(openRow({ ...row, encryptedTitle: name }, key, 'u1')).rejects.toThrow(IntegrityError);
  });

  it('reseals every present legacy column and omits absent ones', async () => {
    const row: StoredCredential = {
      ...base, id: 'r1', userId: 'u1', tags: [],
      encryptedPassword: await legacy('pw'), encryptedTitle: await legacy('Bank'),
    };
    const updates = await resealRow(row, key, 'u1');
    expect(updates).not.toHaveProperty('encryptedUrl');
    expect(updates.userId).toBe('u1');
    await expect(openRow({ ...row, ...updates }, key, 'u1')).resolves.toEqual({
      encryptedPassword: 'pw', encryptedTitle: 'Bank',
    });
  });

  it('carries plaintext-only values into encrypted columns and clears the plaintext', async () => {
    const row: StoredCredential = {
      ...base, id: 'r1', encryptedPassword: await legacy('pw'),
      url: 'https://old.example', notes: 'n', tags: ['t'],
    };
    const updates = await resealRow(row, key, 'u1');
    expect(updates).toMatchObject({ url: undefined, notes: undefined, tags: [] });
    await expect(openRow({ ...row, ...updates }, key, 'u1')).resolves.toEqual({
      encryptedPassword: 'pw', encryptedUrl: 'https://old.example', encryptedNotes: 'n', encryptedTags: '["t"]',
    });
  });

  it('throws when any legacy column is corrupt', async () => {
    const row: StoredCredential = {
      ...base, id: 'r1', userId: 'u1',
      encryptedPassword: await legacy('pw'), encryptedNotes: '{"ciphertext":"AAAA","iv":"AAAAAAAAAAAAAAAA"}',
    };
    await expect(resealRow(row, key, 'u1')).rejects.toThrow(IntegrityError);
  });
});
