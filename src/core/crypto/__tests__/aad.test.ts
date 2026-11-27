import { describe, it, expect } from 'vitest';
import { buildAad, CREDENTIAL_FIELDS, type AadContext, type ExportHeader } from '../aad';

const hex = (ctx: AadContext) => Buffer.from(buildAad(ctx)).toString('hex');
const field: AadContext = { purpose: 'credential-field', userId: 'u1', recordId: 'r1', field: 'encryptedPassword' };
const header: ExportHeader = {
  version: '1.1', exportDate: '2026-11-27T00:00:00.000Z', salt: 'c2FsdA==',
  kdf: 'scrypt', kdfParams: { N: 131072, r: 8, p: 1, dkLen: 32 },
};

describe('buildAad', () => {
  it('lists the 15 encrypted credential columns', () => {
    expect(CREDENTIAL_FIELDS).toHaveLength(15);
    expect(CREDENTIAL_FIELDS[0]).toBe('encryptedPassword');
    expect(CREDENTIAL_FIELDS[14]).toBe('encryptedBackupCodes');
  });

  it('is deterministic', () => {
    expect(hex(field)).toBe(hex({ ...field }));
  });

  it('does not confuse shifted part boundaries', () => {
    expect(hex({ ...field, userId: 'a|b', recordId: 'c' })).not.toBe(hex({ ...field, userId: 'a', recordId: 'b|c' }));
    expect(hex({ ...field, userId: 'ab', recordId: 'c' })).not.toBe(hex({ ...field, userId: 'a', recordId: 'bc' }));
  });

  it('changes with purpose, userId, recordId and field', () => {
    const variants: AadContext[] = [
      field,
      { ...field, userId: 'u2' },
      { ...field, recordId: 'r2' },
      { ...field, field: 'encryptedUrl' },
      { purpose: 'profile-name', userId: 'u1', recordId: 'r1' },
      { purpose: 'vault-key-wrap', userId: 'u1' },
    ];
    expect(new Set(variants.map(hex)).size).toBe(variants.length);
  });

  it('changes with every export header member', () => {
    const variants: ExportHeader[] = [
      header,
      { ...header, version: '1.2' },
      { ...header, exportDate: '2026-11-28T00:00:00.000Z' },
      { ...header, salt: 'b3RoZXI=' },
      { ...header, kdf: 'other' as 'scrypt' },
      { ...header, kdfParams: { ...header.kdfParams, N: 262144 } },
      { ...header, kdfParams: { ...header.kdfParams, r: 9 } },
      { ...header, kdfParams: { ...header.kdfParams, p: 2 } },
      { ...header, kdfParams: { ...header.kdfParams, dkLen: 64 } },
    ];
    expect(new Set(variants.map((h) => hex({ purpose: 'export', header: h }))).size).toBe(variants.length);
  });
});
