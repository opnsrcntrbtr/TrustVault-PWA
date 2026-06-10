/**
 * Import Merge / Round-Trip Tests (Use Case 5 — encrypted import/export)
 *
 * ROADMAP UC5 lists "merge-conflict resolution" as the remaining gap: the
 * merge/duplicate handling lives only inside ImportDialog.tsx, while
 * CredentialRepository.importFromJson() appends unconditionally. These tests
 * pin the repository-layer contract: round-trip fidelity, encryption at
 * rest, S8 validation before any write, and the (documented) absence of
 * repo-level dedupe. If repo-level merge mode is implemented later, the
 * duplication test below is expected to change — update it deliberately.
 *
 * Uses the real repository, real PBKDF2/AES-GCM crypto, and fake-indexeddb.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { db } from '../../storage/database';
import { deriveKeyFromPassword } from '@/core/crypto/encryption';
import type { CredentialInput } from '@/domain/entities/Credential';

const TEST_SALT = new Uint8Array(32).fill(7);

function loginInput(overrides: Partial<CredentialInput> = {}): CredentialInput {
  return {
    title: 'Gmail',
    username: 'user@gmail.com',
    password: 'RoundTripSecret1!',
    url: 'https://gmail.com',
    category: 'login',
    tags: ['email'],
    isFavorite: false,
    ...overrides,
  };
}

describe('importFromJson() merge behavior and round-trips', () => {
  let repository: CredentialRepository;
  let vaultKey: CryptoKey;

  beforeAll(async () => {
    // PBKDF2 (600k, OWASP 2025) — derived once; avoids the scrypt-heavy
    // user-creation path so this suite stays fast.
    vaultKey = await deriveKeyFromPassword('ImportMergeTestPassword1!', TEST_SALT);
  });

  beforeEach(async () => {
    repository = new CredentialRepository();
    await db.credentials.clear();
  });

  it('export → wipe → import round-trips count and decrypted fields', async () => {
    await repository.create(loginInput({ title: 'Gmail' }), vaultKey);
    await repository.create(
      loginInput({ title: 'Bank', username: 'acct-1', password: 'BankSecret2@' }),
      vaultKey
    );

    const exported = await repository.exportAll(vaultKey);
    await db.credentials.clear();
    expect(await db.credentials.count()).toBe(0);

    const imported = await repository.importFromJson(exported, vaultKey);
    expect(imported).toBe(2);

    const restored = await repository.findAll(vaultKey);
    expect(restored).toHaveLength(2);

    const gmail = restored.find((c) => c.title === 'Gmail');
    const bank = restored.find((c) => c.title === 'Bank');
    expect(gmail?.password).toBe('RoundTripSecret1!');
    expect(gmail?.username).toBe('user@gmail.com');
    expect(bank?.password).toBe('BankSecret2@');
    expect(bank?.username).toBe('acct-1');
  });

  it('DOCUMENTS GAP: re-importing the same payload duplicates rows (no repo-level merge)', async () => {
    await repository.create(loginInput(), vaultKey);
    const exported = await repository.exportAll(vaultKey);

    // Import the exported payload back WITHOUT wiping — "merge" at the
    // repository layer simply appends; dedupe only exists in ImportDialog.
    const imported = await repository.importFromJson(exported, vaultKey);
    expect(imported).toBe(1);

    const all = await repository.findAll(vaultKey);
    expect(all).toHaveLength(2); // original + duplicate
    expect(all.filter((c) => c.title === 'Gmail' && c.username === 'user@gmail.com')).toHaveLength(2);
  });

  it('stores imported credentials encrypted at rest (no plaintext secrets in IndexedDB)', async () => {
    const payload = JSON.stringify([
      loginInput({ title: 'AtRest', password: 'NeverPlaintextAtRest3#' }),
    ]);

    const imported = await repository.importFromJson(payload, vaultKey);
    expect(imported).toBe(1);

    const storedRows = await db.credentials.toArray();
    expect(storedRows).toHaveLength(1);
    const rawRow = JSON.stringify(storedRows[0]);
    expect(rawRow).not.toContain('NeverPlaintextAtRest3#');

    // And it decrypts back through the repository
    const restored = await repository.findAll(vaultKey);
    expect(restored[0]?.password).toBe('NeverPlaintextAtRest3#');
  });

  it('rejects a non-array payload before any row is written (S8)', async () => {
    await expect(
      repository.importFromJson('{"not":"an array"}', vaultKey)
    ).rejects.toThrow(/Invalid import data format/);

    expect(await db.credentials.count()).toBe(0);
  });

  it('rejects a payload containing an invalid row before any row is written (S8)', async () => {
    const payload = JSON.stringify([
      loginInput(),
      { title: 'Bad', category: 'not-a-real-category', password: 'x' },
    ]);

    await expect(repository.importFromJson(payload, vaultKey)).rejects.toThrow(
      /Invalid import data format/
    );

    // S8 contract: validation happens BEFORE any write — even the valid
    // first row must not have been imported.
    expect(await db.credentials.count()).toBe(0);
  });

  it('rejects malformed JSON before any row is written (S8)', async () => {
    await expect(repository.importFromJson('not json at all', vaultKey)).rejects.toThrow(
      /Invalid import data format/
    );
    expect(await db.credentials.count()).toBe(0);
  });
});
