/**
 * S5 — Metadata at rest encryption tests
 *
 * SECURITY_PWA_ENHANCEMENT_PLAN.md §S5:
 * "title, username, url, tags, cardholderName, expiryMonth, expiryYear,
 *  cardType, billingAddress must NOT appear in plaintext in IndexedDB."
 *
 * Design:
 *  - CredentialRepository.create/update writes `encryptedTitle`, `encryptedUsername`,
 *    `encryptedUrl`, `encryptedTags` etc. and never writes plaintext metadata.
 *  - decryptCredential() decrypts those fields; falls back to legacy plaintext
 *    for pre-v5 records that haven't been sealed yet.
 *  - sealLegacyMetadata(vaultKey) encrypts any unsealed (plaintext) records that
 *    were created before the v5 migration.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { sealLegacyMetadata } from '../metadataSealing';
import { db } from '../../storage/database';
import { encrypt } from '@/core/crypto/encryption';
import type { StoredCredential } from '../../storage/database';

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

let repo: CredentialRepository;
let vaultKey: CryptoKey;

beforeEach(async () => {
  repo = new CredentialRepository();
  const userRepo = new UserRepositoryImpl();
  await db.users.clear();
  await db.credentials.clear();
  await db.loginAttempts.clear();

  const user = await userRepo.createUser('meta@example.com', 'TestPassword123!');
  const session = await userRepo.authenticateWithPassword('meta@example.com', 'TestPassword123!');
  vaultKey = session.vaultKey;
  void user; // suppress unused warning
});

afterEach(async () => {
  await db.users.clear();
  await db.credentials.clear();
  await db.loginAttempts.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Storage isolation: new records must never expose plaintext metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('create() — metadata stored encrypted (S5)', () => {
  it('stores title encrypted, not in plaintext', async () => {
    await repo.create(
      { title: 'GitHub', username: 'dev@example.com', password: 'secret', category: 'login', tags: [] },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    expect(stored).toBeDefined();
    // The plaintext field must be absent / empty
    expect(stored?.title).toBeFalsy();
    // The encrypted field must be present
    expect(stored?.encryptedTitle).toBeTruthy();
    // And the encrypted blob must not contain the literal title
    expect(stored?.encryptedTitle).not.toContain('GitHub');
  });

  it('stores username encrypted, not in plaintext', async () => {
    await repo.create(
      { title: 'T', username: 'alice@example.com', password: 'secret', category: 'login', tags: [] },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    expect(stored?.username).toBeFalsy();
    expect(stored?.encryptedUsername).toBeTruthy();
    expect(stored?.encryptedUsername).not.toContain('alice@example.com');
  });

  it('stores url encrypted when provided', async () => {
    await repo.create(
      { title: 'T', username: 'u', password: 'p', url: 'https://example.com', category: 'login', tags: [] },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    expect(stored?.url).toBeFalsy();
    expect(stored?.encryptedUrl).toBeTruthy();
    expect(stored?.encryptedUrl).not.toContain('example.com');
  });

  it('stores tags encrypted when provided', async () => {
    await repo.create(
      { title: 'T', username: 'u', password: 'p', category: 'login', tags: ['work', 'finance'] },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    // Raw tags array should be absent/empty
    expect(!stored?.tags || stored.tags.length === 0).toBe(true);
    expect(stored?.encryptedTags).toBeTruthy();
    expect(stored?.encryptedTags).not.toContain('work');
    expect(stored?.encryptedTags).not.toContain('finance');
  });

  it('marks new records as sealed', async () => {
    await repo.create(
      { title: 'T', username: 'u', password: 'p', category: 'login', tags: [] },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    expect(stored?.isSealed).toBe(true);
  });
});

describe('create() — card metadata stored encrypted (S5)', () => {
  it('stores cardholderName, expiryMonth, expiryYear, billingAddress encrypted', async () => {
    await repo.create(
      {
        title: 'Visa',
        username: '',
        password: '',
        category: 'credit_card',
        tags: [],
        cardholderName: 'Alice Smith',
        expiryMonth: '06',
        expiryYear: '2028',
        billingAddress: '123 Main St',
        cardType: 'visa',
      },
      vaultKey
    );

    const [stored] = await db.credentials.toArray();
    // Legacy plaintext card fields must be absent
    expect(stored?.cardholderName).toBeFalsy();
    expect(stored?.expiryMonth).toBeFalsy();
    expect(stored?.expiryYear).toBeFalsy();
    expect(stored?.billingAddress).toBeFalsy();
    expect(stored?.cardType).toBeFalsy();

    // Encrypted fields must be present and not contain plaintext
    expect(stored?.encryptedCardholderName).toBeTruthy();
    expect(stored?.encryptedExpiryMonth).toBeTruthy();
    expect(stored?.encryptedExpiryYear).toBeTruthy();
    expect(stored?.encryptedBillingAddress).toBeTruthy();
    expect(stored?.encryptedCardType).toBeTruthy();

    expect(stored?.encryptedCardholderName).not.toContain('Alice');
    expect(stored?.encryptedBillingAddress).not.toContain('Main St');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Round-trip: decrypted values must equal originals
// ─────────────────────────────────────────────────────────────────────────────

describe('findById() — decrypts metadata fields (S5)', () => {
  it('returns the correct title after create', async () => {
    const created = await repo.create(
      { title: 'GitHub', username: 'dev', password: 'sec', category: 'login', tags: [] },
      vaultKey
    );

    const found = await repo.findById(created.id, vaultKey);
    expect(found?.title).toBe('GitHub');
  });

  it('returns the correct username after create', async () => {
    const created = await repo.create(
      { title: 'T', username: 'alice@example.com', password: 'p', category: 'login', tags: [] },
      vaultKey
    );

    const found = await repo.findById(created.id, vaultKey);
    expect(found?.username).toBe('alice@example.com');
  });

  it('returns the correct url after create', async () => {
    const created = await repo.create(
      { title: 'T', username: 'u', password: 'p', url: 'https://github.com', category: 'login', tags: [] },
      vaultKey
    );

    const found = await repo.findById(created.id, vaultKey);
    expect(found?.url).toBe('https://github.com');
  });

  it('returns the correct tags after create', async () => {
    const created = await repo.create(
      { title: 'T', username: 'u', password: 'p', category: 'login', tags: ['work', 'git'] },
      vaultKey
    );

    const found = await repo.findById(created.id, vaultKey);
    expect(found?.tags).toEqual(['work', 'git']);
  });

  it('returns decrypted card fields', async () => {
    const created = await repo.create(
      {
        title: 'Card',
        username: '',
        password: '',
        category: 'credit_card',
        tags: [],
        cardholderName: 'Bob Jones',
        expiryMonth: '12',
        expiryYear: '2030',
        billingAddress: '99 Elm St',
        cardType: 'mastercard',
      },
      vaultKey
    );

    const found = await repo.findById(created.id, vaultKey);
    expect(found?.cardholderName).toBe('Bob Jones');
    expect(found?.expiryMonth).toBe('12');
    expect(found?.expiryYear).toBe('2030');
    expect(found?.billingAddress).toBe('99 Elm St');
    expect(found?.cardType).toBe('mastercard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Search still works against decrypted metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('search() — works on encrypted metadata (S5)', () => {
  it('finds by title', async () => {
    await repo.create({ title: 'GitHub', username: 'dev', password: 'p', category: 'login', tags: [] }, vaultKey);
    await repo.create({ title: 'GitLab', username: 'dev', password: 'p', category: 'login', tags: [] }, vaultKey);

    const results = await repo.search('GitHub', vaultKey);
    expect(results.length).toBe(1);
    expect(results[0]?.title).toBe('GitHub');
  });

  it('finds by username', async () => {
    await repo.create({ title: 'A', username: 'alice@corp.com', password: 'p', category: 'login', tags: [] }, vaultKey);
    await repo.create({ title: 'B', username: 'bob@corp.com',   password: 'p', category: 'login', tags: [] }, vaultKey);

    const results = await repo.search('alice', vaultKey);
    expect(results.length).toBe(1);
    expect(results[0]?.username).toBe('alice@corp.com');
  });

  it('finds by url', async () => {
    await repo.create({ title: 'A', username: 'u', password: 'p', url: 'https://example.com', category: 'login', tags: [] }, vaultKey);
    await repo.create({ title: 'B', username: 'u', password: 'p', url: 'https://other.com',   category: 'login', tags: [] }, vaultKey);

    const results = await repo.search('example.com', vaultKey);
    expect(results.length).toBe(1);
    expect(results[0]?.url).toBe('https://example.com');
  });

  it('finds by tag', async () => {
    await repo.create({ title: 'A', username: 'u', password: 'p', category: 'login', tags: ['finance'] }, vaultKey);
    await repo.create({ title: 'B', username: 'u', password: 'p', category: 'login', tags: ['personal'] }, vaultKey);

    const results = await repo.search('finance', vaultKey);
    expect(results.length).toBe(1);
    expect(results[0]?.tags).toContain('finance');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sealing migration — legacy plaintext records get upgraded
// ─────────────────────────────────────────────────────────────────────────────

describe('sealLegacyMetadata() (S5)', () => {
  /**
   * Inserts a record that looks like it was written before the v5 migration:
   * plaintext title/username/url/tags, no encryptedTitle, isSealed absent.
   */
  async function insertLegacyRecord(overrides: Partial<StoredCredential> = {}): Promise<string> {
    const id = crypto.randomUUID();
    // Use a real encrypted password blob so decryptCredential can succeed after sealing
    const encryptedPassword = JSON.stringify(await encrypt('legacy-password', vaultKey));
    await db.credentials.add({
      id,
      title: 'LegacyTitle',
      username: 'legacy@example.com',
      url: 'https://legacy.example.com',
      tags: ['old', 'plaintext'],
      encryptedPassword,
      category: 'login',
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // isSealed intentionally absent → legacy record
      ...overrides,
    } as StoredCredential);
    return id;
  }

  it('encrypts title/username/url/tags of a legacy record', async () => {
    const id = await insertLegacyRecord();

    const count = await sealLegacyMetadata(vaultKey);
    expect(count).toBe(1);

    const sealed = await db.credentials.get(id);
    expect(sealed?.isSealed).toBe(true);

    // Plaintext fields must be cleared
    expect(sealed?.title).toBeFalsy();
    expect(sealed?.username).toBeFalsy();
    expect(sealed?.url).toBeFalsy();
    expect(!sealed?.tags || sealed.tags.length === 0).toBe(true);

    // Encrypted fields must be present
    expect(sealed?.encryptedTitle).toBeTruthy();
    expect(sealed?.encryptedUsername).toBeTruthy();
    expect(sealed?.encryptedUrl).toBeTruthy();
    expect(sealed?.encryptedTags).toBeTruthy();
  });

  it('makes a sealed legacy record readable via findById', async () => {
    const id = await insertLegacyRecord();
    await sealLegacyMetadata(vaultKey);

    // The repo must still be able to decrypt and return the right values
    const found = await repo.findById(id, vaultKey);
    expect(found?.title).toBe('LegacyTitle');
    expect(found?.username).toBe('legacy@example.com');
    expect(found?.url).toBe('https://legacy.example.com');
    expect(found?.tags).toEqual(['old', 'plaintext']);
  });

  it('skips records that are already sealed', async () => {
    // Already-sealed record from a modern create() call
    await repo.create({ title: 'New', username: 'u', password: 'p', category: 'login', tags: [] }, vaultKey);
    await insertLegacyRecord(); // one legacy record

    const count = await sealLegacyMetadata(vaultKey);
    expect(count).toBe(1); // only the legacy record was sealed
  });

  it('is idempotent — calling twice does not double-seal or fail', async () => {
    const id = await insertLegacyRecord();
    await sealLegacyMetadata(vaultKey);
    const second = await sealLegacyMetadata(vaultKey);
    expect(second).toBe(0);

    const record = await db.credentials.get(id);
    expect(record?.isSealed).toBe(true);
  });

  it('seals card-metadata plaintext fields', async () => {
    const id = await insertLegacyRecord({
      category: 'credit_card',
      cardholderName: 'Carol White',
      expiryMonth: '03',
      expiryYear: '2027',
      billingAddress: '1 Park Ave',
      cardType: 'amex',
    });

    await sealLegacyMetadata(vaultKey);

    const sealed = await db.credentials.get(id);
    expect(sealed?.cardholderName).toBeFalsy();
    expect(sealed?.expiryMonth).toBeFalsy();
    expect(sealed?.expiryYear).toBeFalsy();
    expect(sealed?.billingAddress).toBeFalsy();
    expect(sealed?.cardType).toBeFalsy();

    expect(sealed?.encryptedCardholderName).toBeTruthy();
    expect(sealed?.encryptedExpiryMonth).toBeTruthy();
    expect(sealed?.encryptedExpiryYear).toBeTruthy();
    expect(sealed?.encryptedBillingAddress).toBeTruthy();
    expect(sealed?.encryptedCardType).toBeTruthy();
  });
});
