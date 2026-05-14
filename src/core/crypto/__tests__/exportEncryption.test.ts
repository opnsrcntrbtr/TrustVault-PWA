import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptImport,
  downloadExportFile,
  encryptExport,
  generateExportFilename,
  readImportFile,
} from '../exportEncryption';
import { deriveKeyFromPassword, encrypt } from '../encryption';
import type { Credential } from '@/domain/entities/Credential';

vi.mock('../encryption', () => ({
  deriveKeyFromPassword: vi.fn((password: string, salt: Uint8Array) => Promise.resolve({
    password,
    salt: Array.from(salt),
  })),
  encrypt: vi.fn((plaintext: string, key: unknown) => Promise.resolve({
    ciphertext: btoa(JSON.stringify({ plaintext, password: (key as { password: string }).password })),
    iv: btoa('mock-iv'),
  })),
  decrypt: vi.fn((encryptedData: { ciphertext: string }, key: unknown) => {
    const parsed = JSON.parse(atob(encryptedData.ciphertext)) as {
      plaintext: string;
      password: string;
    };
    if (parsed.password !== (key as { password: string }).password) {
      return Promise.reject(new Error('wrong password'));
    }
    return Promise.resolve(parsed.plaintext);
  }),
}));

const sampleCredentials: Credential[] = [
  {
    id: 'cred-1',
    title: 'GitHub',
    username: 'alice',
    password: 'S3cure!Pass',
    category: 'login',
    tags: ['work', 'dev'],
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-10T10:00:00.000Z'),
    isFavorite: true,
    notes: 'main account',
  },
];

describe('exportEncryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encrypts and decrypts exports with date preservation', async () => {
    const exportJson = await encryptExport(sampleCredentials, 'ExportPass!123');
    const parsedUnknown: unknown = JSON.parse(exportJson);
    const parsed = parsedUnknown as {
      version: string;
      salt: string;
      encryptedData: string;
      encryptionParams: { algorithm: string };
    };

    expect(parsed.version).toBe('1.0');
    expect(parsed.encryptionParams.algorithm).toBe('AES-256-GCM');
    expect(parsed.salt).toBeTypeOf('string');
    expect(parsed.encryptedData).toBeTypeOf('string');

    const decrypted = await decryptImport(exportJson, 'ExportPass!123');

    expect(decrypted).toHaveLength(1);
    expect(decrypted[0]?.title).toBe('GitHub');
    expect(decrypted[0]?.createdAt).toBeInstanceOf(Date);
    expect(decrypted[0]?.updatedAt).toBeInstanceOf(Date);
    expect(decrypted[0]?.createdAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(decrypted[0]?.updatedAt.toISOString()).toBe('2026-01-10T10:00:00.000Z');
  });

  it('rejects malformed export JSON', async () => {
    await expect(decryptImport('{bad-json', 'pw')).rejects.toThrow('Invalid export file format');
  });

  it('rejects invalid export structure', async () => {
    const invalid = JSON.stringify({ version: '1.0' });
    await expect(decryptImport(invalid, 'pw')).rejects.toThrow('Invalid export file structure');
  });

  it('rejects unsupported export version', async () => {
    const unsupported = JSON.stringify({
      version: '2.0',
      salt: 'abc',
      encryptedData: '{}',
      encryptionParams: {},
    });

    await expect(decryptImport(unsupported, 'pw')).rejects.toThrow('Unsupported export version: 2.0');
  });

  it('rejects invalid encrypted data JSON', async () => {
    const validExportUnknown: unknown = JSON.parse(
      await encryptExport(sampleCredentials, 'ExportPass!123')
    );
    const validExport = validExportUnknown as {
      version: string;
      exportDate: string;
      salt: string;
      encryptedData: string;
      encryptionParams: { algorithm: string; iterations: number };
    };
    validExport.encryptedData = '{not-json';

    await expect(decryptImport(JSON.stringify(validExport), 'ExportPass!123')).rejects.toThrow(
      'Invalid encrypted data format'
    );
  });

  it('rejects wrong password for a valid export', async () => {
    const exportJson = await encryptExport(sampleCredentials, 'CorrectPassword!');

    await expect(decryptImport(exportJson, 'WrongPassword!')).rejects.toThrow(
      'Failed to decrypt export. Invalid password or corrupted file.'
    );
  });

  it('rejects decrypted payload without credentials array', async () => {
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);
    const key = await deriveKeyFromPassword('ExportPass!123', salt);
    const encryptedData = await encrypt(JSON.stringify({ wrongShape: true }), key);

    const crafted = JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      salt: btoa(String.fromCharCode(...salt)),
      encryptedData: JSON.stringify(encryptedData),
      encryptionParams: { algorithm: 'AES-256-GCM', iterations: 600000 },
    });

    await expect(decryptImport(crafted, 'ExportPass!123')).rejects.toThrow('Invalid credentials data');
  });

  it('generates export filename using expected extension and prefix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T08:57:11.000Z'));

    const filename = generateExportFilename();

    expect(filename).toBe('trustvault-backup-2026-05-14.tvault');

    vi.useRealTimers();
  });

  it('creates and revokes object URL when downloading export file', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadExportFile('{"ok":true}', 'vault.tvault');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('reads import file content as text', async () => {
    const OriginalFileReader = globalThis.FileReader;

    class MockFileReader {
      public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      public onerror: (() => void) | null = null;

      readAsText(): void {
        this.onload?.({ target: { result: '{"credentials":[]}' } } as ProgressEvent<FileReader>);
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      value: MockFileReader,
      configurable: true,
      writable: true,
    });

    const file = new File(['ignored'], 'vault.tvault', { type: 'application/json' });
    await expect(readImportFile(file)).resolves.toBe('{"credentials":[]}');

    Object.defineProperty(globalThis, 'FileReader', {
      value: OriginalFileReader,
      configurable: true,
      writable: true,
    });
  });

  it('rejects when file reading fails', async () => {
    const OriginalFileReader = globalThis.FileReader;

    class ErrorFileReader {
      public onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      public onerror: (() => void) | null = null;

      readAsText(): void {
        this.onerror?.();
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      value: ErrorFileReader,
      configurable: true,
      writable: true,
    });

    const file = new File(['ignored'], 'vault.tvault', { type: 'application/json' });
    await expect(readImportFile(file)).rejects.toThrow('Failed to read file');

    Object.defineProperty(globalThis, 'FileReader', {
      value: OriginalFileReader,
      configurable: true,
      writable: true,
    });
  });
});
