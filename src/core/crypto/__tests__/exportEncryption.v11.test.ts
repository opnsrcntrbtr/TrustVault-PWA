import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as encryption from '../encryption';
import { encryptExport, decryptImport, type VaultExport } from '../exportEncryption';
import type { Credential } from '@/domain/entities/Credential';
import fixture10 from './__fixtures__/vault-export-1.0.json?raw';

const PASSWORD = 'ExportPass!12345';
const cred: Credential = {
  id: 'c1', title: 'Bank', username: 'alice', password: 'pw', category: 'login', tags: [], isFavorite: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
let json: string;
beforeAll(async () => {
  json = await encryptExport([cred, { ...cred, id: 'c2', title: 'Integrity check failed', password: '', integrityError: true }], PASSWORD);
}, 60000);

const tampered = (change: (e: VaultExport & { encryptionParams: Record<string, unknown> }) => void) => {
  const parsed = JSON.parse(json) as VaultExport & { encryptionParams: Record<string, unknown> };
  change(parsed);
  return JSON.stringify(parsed);
};

describe('.tvault 1.1', () => {
  it('writes scrypt parameters, round-trips and omits integrity-failed rows', async () => {
    expect(JSON.parse(json)).toMatchObject({
      version: '1.1',
      encryptionParams: { algorithm: 'AES-256-GCM', kdf: 'scrypt', N: 131072, r: 8, p: 1, dkLen: 32 },
    });
    const imported = await decryptImport(json, PASSWORD);
    expect(imported.map((c) => c.title)).toEqual(['Bank']);
  }, 60000);

  it.each<[string, Parameters<typeof tampered>[0]]>([
    ['exportDate', (e) => { e.exportDate = '2020-01-01T00:00:00.000Z'; }],
    ['salt', (e) => { e.salt = btoa('x'.repeat(32)); }],
    ['N', (e) => { e.encryptionParams['N'] = 262144; }],
    ['p', (e) => { e.encryptionParams['p'] = 2; }],
    ['version downgrade', (e) => { e.version = '1.0'; }],
  ])('rejects a changed %s', async (_name, change) => {
    await expect(decryptImport(tampered(change), PASSWORD)).rejects.toThrow('Invalid password or corrupted file');
  }, 60000);

  it.each<[string, unknown]>([
    ['N', 16384], ['N', 2097152], ['N', 131073], ['r', 1], ['r', 9], ['p', 5], ['p', 0], ['dkLen', 16], ['kdf', 'pbkdf2'],
  ])('rejects %s=%s before deriving a key', async (name, value) => {
    const derive = vi.spyOn(encryption, 'deriveScryptKey');
    await expect(decryptImport(tampered((e) => { e.encryptionParams[name] = value; }), PASSWORD))
      .rejects.toThrow('Unsupported export encryption parameters');
    expect(derive).not.toHaveBeenCalled();
    derive.mockRestore();
  });

  it('still imports a 1.0 backup', async () => {
    await expect(decryptImport(fixture10, 'FixtureExportPass!1')).resolves.toMatchObject([
      { title: 'Fixture', password: 'fixture-password' },
    ]);
  }, 60000);
});
