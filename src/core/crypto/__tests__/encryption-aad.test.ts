import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, generateEncryptionKey, type EncryptedData } from '../encryption';
import { buildAad, type AadContext } from '../aad';

const ctx: AadContext = { purpose: 'credential-field', userId: 'u1', recordId: 'r1', field: 'encryptedPassword' };
let key: CryptoKey;
beforeAll(async () => { key = await generateEncryptionKey(); });

describe('encrypt/decrypt with AAD', () => {
  it('marks AAD ciphertexts v2 and round-trips', async () => {
    const data = await encrypt('s3cret', key, buildAad(ctx));
    expect(data.v).toBe(2);
    await expect(decrypt(data, key, buildAad(ctx))).resolves.toBe('s3cret');
  });

  it.each<[string, AadContext]>([
    ['user', { ...ctx, userId: 'u2' }],
    ['record', { ...ctx, recordId: 'r2' }],
    ['field', { ...ctx, field: 'encryptedUrl' }],
    ['purpose', { purpose: 'profile-name', userId: 'u1', recordId: 'r1' }],
  ])('rejects a different %s', async (_name, other) => {
    const data = await encrypt('s3cret', key, buildAad(ctx));
    await expect(decrypt(data, key, buildAad(other))).rejects.toThrow('Failed to decrypt data');
  });

  it('rejects v2 without AAD, with v removed, or with an unknown v', async () => {
    const data = await encrypt('s3cret', key, buildAad(ctx));
    await expect(decrypt(data, key)).rejects.toThrow('Failed to decrypt data');
    const { v: _v, ...stripped } = data;
    await expect(decrypt(stripped, key, buildAad(ctx))).rejects.toThrow('Failed to decrypt data');
    await expect(decrypt({ ...data, v: 3 } as unknown as EncryptedData, key, buildAad(ctx))).rejects.toThrow('Failed to decrypt data');
  });

  it('keeps legacy ciphertexts unmarked and readable with or without AAD', async () => {
    const data = await encrypt('old', key);
    expect(data).not.toHaveProperty('v');
    await expect(decrypt(data, key)).resolves.toBe('old');
    await expect(decrypt(data, key, buildAad(ctx))).resolves.toBe('old');
  });
});
