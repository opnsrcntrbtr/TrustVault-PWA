import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { sealLegacyMetadata } from '../metadataSealing';
import { IntegrityError, openRow } from '../credentialRowCrypto';
import { db, type StoredCredential } from '../../storage/database';
import { encrypt, generateEncryptionKey } from '@/core/crypto/encryption';
import { CREDENTIAL_FIELDS } from '@/core/crypto/aad';
import type { CredentialInput } from '@/domain/entities/Credential';

const repo = new CredentialRepository();
const USER = 'user-1';
let key: CryptoKey;

const input: CredentialInput = {
  title: 'Bank', username: 'alice', password: 'Correct-Horse-Battery-9!', url: 'https://bank.example',
  notes: 'note', category: 'login', tags: ['money'], totpSecret: 'JBSWY3DPEHPK3PXP',
  cardNumber: '4111111111111111', cvv: '123',
  backupCodes: [{ id: 'b1', code: '12345678', consumed: false }],
};

const stored = async (id: string) => (await db.credentials.get(id)) as StoredCredential;
const versions = (row: StoredCredential) =>
  CREDENTIAL_FIELDS.filter((f) => row[f] !== undefined).map((f) => (JSON.parse(row[f] as string) as { v?: number }).v);
const legacyBlob = async (value: string) => JSON.stringify(await encrypt(value, key));

async function addLegacyRow(id: string, extra: Partial<StoredCredential> = {}): Promise<void> {
  await db.credentials.add({
    id, userId: USER, category: 'login', isFavorite: false, createdAt: 1, updatedAt: 1, isSealed: true, tags: [],
    encryptedPassword: await legacyBlob('old-password'),
    encryptedTitle: await legacyBlob('Old'),
    encryptedUrl: await legacyBlob('https://old.example'),
    ...extra,
  });
}

function expectLocked(c: Awaited<ReturnType<typeof repo.findById>>): void {
  expect(c).toMatchObject({ integrityError: true, title: 'Integrity check failed', username: '', password: '', tags: [] });
  for (const k of ['url', 'notes', 'totpSecret', 'cardNumber', 'cvv', 'backupCodes'] as const) {
    expect(c?.[k]).toBeUndefined();
  }
}

beforeAll(async () => { key = await generateEncryptionKey(); });
beforeEach(async () => { await db.credentials.clear(); });

describe('CredentialRepository row integrity', () => {
  it('creates rows with only v2 columns and reads them back', async () => {
    const created = await repo.create(input, key, USER);
    const v = versions(await stored(created.id));
    expect(v.length).toBeGreaterThanOrEqual(9);
    expect(v.every((x) => x === 2)).toBe(true);
    await expect(repo.findById(created.id, key, USER)).resolves.toMatchObject({
      title: 'Bank', url: 'https://bank.example', cvv: '123', tags: ['money'], backupCodes: input.backupCodes,
    });
  });

  it('ignores injected plaintext columns on a v2 row', async () => {
    const { id } = await repo.create(input, key, USER);
    await db.credentials.update(id, {
      encryptedUrl: undefined, url: 'https://evil.example',
      encryptedTitle: undefined, title: 'Evil',
      encryptedNotes: undefined, notes: 'evil',
      encryptedTags: undefined, tags: ['evil'],
    });
    const read = await repo.findById(id, key, USER);
    expect(read?.password).toBe(input.password);
    expect(read?.url).toBeUndefined();
    expect(read?.notes).toBeUndefined();
    expect(read?.title).toBe('');
    expect(read?.tags).toEqual([]);
  });

  it('locks rows whose password blobs were swapped, but still lists them', async () => {
    const a = await repo.create(input, key, USER);
    const b = await repo.create({ ...input, title: 'Other' }, key, USER);
    const [ra, rb] = [await stored(a.id), await stored(b.id)];
    await db.credentials.update(a.id, { encryptedPassword: rb.encryptedPassword });
    await db.credentials.update(b.id, { encryptedPassword: ra.encryptedPassword });
    const all = await repo.findAll(key, USER);
    expect(all).toHaveLength(2);
    all.forEach(expectLocked);
  });

  it('locks the row when any optional column is tampered with', async () => {
    const { id } = await repo.create(input, key, USER);
    await db.credentials.update(id, { encryptedCvv: (await stored(id)).encryptedPassword });
    expectLocked(await repo.findById(id, key, USER));
  });

  it('does not let sealLegacyMetadata launder plaintext into a v2 row', async () => {
    const { id } = await repo.create(input, key, USER);
    const before = (await stored(id)).encryptedUrl;
    await db.credentials.update(id, { isSealed: false, url: 'https://evil.example' });
    await sealLegacyMetadata(key, USER);
    expect((await stored(id)).encryptedUrl).toBe(before);
    await expect(repo.findById(id, key, USER)).resolves.toMatchObject({ url: 'https://bank.example' });
  });

  it('refuses to update a failed row, leaves it unchanged, and still deletes it', async () => {
    const { id } = await repo.create(input, key, USER);
    await db.credentials.update(id, { encryptedCvv: (await stored(id)).encryptedPassword });
    const before = await stored(id);
    await expect(repo.update(id, { isFavorite: true }, key, USER)).rejects.toThrow(IntegrityError);
    await expect(repo.update(id, { password: 'new' }, key, USER)).rejects.toThrow(IntegrityError);
    expect(await stored(id)).toEqual(before);
    await repo.delete(id, key, USER);
    expect(await db.credentials.get(id)).toBeUndefined();
  });

  it('upgrades the whole row before a partial write to a legacy row', async () => {
    await addLegacyRow('legacy-1');
    await repo.update('legacy-1', { password: 'brand-new-password' }, key, USER);
    const row = await stored('legacy-1');
    expect(versions(row)).toEqual([2, 2, 2]);
    await expect(openRow(row, key, USER)).resolves.toMatchObject({
      encryptedPassword: 'brand-new-password', encryptedTitle: 'Old', encryptedUrl: 'https://old.example',
    });
  });

  it('seals then upgrades an unsealed legacy row on update', async () => {
    await addLegacyRow('legacy-2', { isSealed: false, encryptedTitle: undefined, title: 'Plain' });
    const updated = await repo.update('legacy-2', { isFavorite: true }, key, USER);
    expect(updated).toMatchObject({ title: 'Plain', isFavorite: true });
    expect(versions(await stored('legacy-2')).every((v) => v === 2)).toBe(true);
  });

  it('refuses to update a legacy row with a corrupt column', async () => {
    await addLegacyRow('legacy-3', { encryptedNotes: '{"ciphertext":"AAAA","iv":"AAAAAAAAAAAAAAAA"}' });
    const before = await stored('legacy-3');
    await expect(repo.update('legacy-3', { password: 'x' }, key, USER)).rejects.toThrow(IntegrityError);
    expect(await stored('legacy-3')).toEqual(before);
  });

  it('reads a cleared optional field as empty, not as a failure', async () => {
    const { id } = await repo.create(input, key, USER);
    const updated = await repo.update(id, { url: '' }, key, USER);
    expect(updated.integrityError).toBeUndefined();
    expect(updated.url).toBeUndefined();
    expect(updated.password).toBe(input.password);
  });

  it('lets only the owner key claim an unowned v2 row', async () => {
    const { id } = await repo.create(input, key, USER);
    await db.credentials.update(id, { userId: undefined });
    await expect(repo.findAll(await generateEncryptionKey(), 'intruder')).resolves.toEqual([]);
    await expect(repo.findById(id, key, USER)).resolves.toMatchObject({ title: 'Bank', password: input.password });
    await expect(repo.findAll(key, USER)).resolves.toHaveLength(1);
  });

  it('re-scores a v2 row', async () => {
    const { id } = await repo.create(input, key, USER);
    await db.credentials.update(id, { securityScore: 0 });
    await expect(repo.analyzeSecurityScore(id, key, USER)).resolves.toBeGreaterThan(0);
  });

  it('leaves failed rows out of exportAll', async () => {
    await repo.create(input, key, USER);
    const bad = await repo.create({ ...input, title: 'Bad' }, key, USER);
    await db.credentials.update(bad.id, { encryptedCvv: (await stored(bad.id)).encryptedPassword });
    const exported = JSON.parse(await repo.exportAll(key, USER)) as Array<{ title: string }>;
    expect(exported.map((c) => c.title)).toEqual(['Bank']);
  });
});
