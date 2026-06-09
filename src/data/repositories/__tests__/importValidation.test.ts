/**
 * S8 — vault import schema validation tests
 * (SECURITY_HARDENING_PLAN_2026-06.md Phase E)
 */
import { describe, it, expect } from 'vitest';
import { parseImportPayload, IMPORT_LIMITS } from '../importValidation';

const validEntry = {
  title: 'Gmail',
  username: 'user@gmail.com',
  password: 'S3cret!',
  category: 'login',
  tags: ['email'],
  isFavorite: false,
};

describe('parseImportPayload', () => {
  it('accepts a valid export payload', () => {
    const rows = parseImportPayload(JSON.stringify([validEntry]));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Gmail');
  });

  it('accepts an empty array', () => {
    expect(parseImportPayload('[]')).toEqual([]);
  });

  it('strips unknown keys instead of rejecting (forward compatibility)', () => {
    const rows = parseImportPayload(
      JSON.stringify([{ ...validEntry, futureField: 'x', __proto__pollution: 'y' }]),
    );
    expect(rows[0]).not.toHaveProperty('futureField');
  });

  it('rejects non-JSON input', () => {
    expect(() => parseImportPayload('not json')).toThrow(/invalid import data format/i);
  });

  it('rejects a non-array root', () => {
    expect(() => parseImportPayload(JSON.stringify({ a: 1 }))).toThrow(
      /invalid import data format/i,
    );
  });

  it('rejects wrong-typed fields', () => {
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...validEntry, tags: 'not-an-array' }])),
    ).toThrow(/invalid import data format/i);
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...validEntry, isFavorite: 'yes' }])),
    ).toThrow(/invalid import data format/i);
  });

  it('rejects unknown categories and card types', () => {
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...validEntry, category: 'evil' }])),
    ).toThrow(/invalid import data format/i);
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...validEntry, cardType: 'evil' }])),
    ).toThrow(/invalid import data format/i);
  });

  it('rejects oversized fields', () => {
    const huge = 'a'.repeat(IMPORT_LIMITS.maxFieldLength + 1);
    expect(() =>
      parseImportPayload(JSON.stringify([{ ...validEntry, title: huge }])),
    ).toThrow(/invalid import data format/i);
  });

  it('rejects payloads with too many entries', () => {
    const rows = Array.from({ length: IMPORT_LIMITS.maxEntries + 1 }, () => validEntry);
    expect(() => parseImportPayload(JSON.stringify(rows))).toThrow(
      /invalid import data format/i,
    );
  });

  it('points at the offending entry in the error message', () => {
    expect(() =>
      parseImportPayload(JSON.stringify([validEntry, { ...validEntry, category: 42 }])),
    ).toThrow(/entry 1/);
  });
});
