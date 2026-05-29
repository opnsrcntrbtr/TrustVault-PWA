/**
 * Tests for issues raised in the Copilot code review of PR #34.
 * Each describe block is named after the comment_id it fixes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialRepository } from '../CredentialRepositoryImpl';
import { UserRepositoryImpl } from '../UserRepositoryImpl';
import { sealLegacyMetadata } from '../metadataSealing';
import { db } from '../../storage/database';
import { encrypt } from '@/core/crypto/encryption';

let repo: CredentialRepository;
let vaultKey: CryptoKey;

async function makeVaultKey(): Promise<CryptoKey> {
  const userRepo = new UserRepositoryImpl();
  const email = `fix-test-${crypto.randomUUID()}@example.com`;
  await userRepo.createUser(email, 'TestPassword123!');
  const session = await userRepo.authenticateWithPassword(email, 'TestPassword123!');
  return session.vaultKey;
}

beforeEach(async () => {
  repo = new CredentialRepository();
  await db.users.clear();
  await db.credentials.clear();
  await db.loginAttempts.clear();
  vaultKey = await makeVaultKey();
});

afterEach(async () => {
  await db.users.clear();
  await db.credentials.clear();
  await db.loginAttempts.clear();
});

// ── comment 3324555923 ────────────────────────────────────────────────────────
// update() set isSealed:true even for a partial update (isFavorite only) on a
// legacy row — marking it sealed WITHOUT encrypting/clearing plaintext metadata.

describe('comment 3324555923: partial update must not prematurely mark legacy row as sealed', () => {
  async function insertLegacyRow() {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    await db.credentials.add({
      id, title: 'LegacyTitle', username: 'legacy@example.com',
      encryptedPassword: ep, category: 'login' as const,
      tags: ['old'], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
      // isSealed absent → pre-v5
    });
    return id;
  }

  it('a partial update (isFavorite only) leaves a legacy row unsealed so sealLegacyMetadata can still process it', async () => {
    const id = await insertLegacyRow();

    await repo.update(id, { isFavorite: true }, vaultKey);

    const stored = await db.credentials.get(id);
    // Must still be unsealed so sealLegacyMetadata picks it up
    expect(stored?.isSealed).toBeFalsy();
    // Plaintext title must still be present (not corrupted by a false-seal)
    expect(stored?.title).toBe('LegacyTitle');
  });

  it('a full metadata update on a legacy row encrypts and clears the updated fields (sealLegacyMetadata handles final isSealed)', async () => {
    const id = await insertLegacyRow();

    await repo.update(id, { title: 'NewTitle', username: 'new@example.com', url: 'https://new.example.com', tags: ['work'] }, vaultKey);

    const stored = await db.credentials.get(id);
    // Updated plaintext fields must be cleared
    expect(stored?.title).toBeFalsy();
    expect(stored?.username).toBeFalsy();
    expect(stored?.url).toBeFalsy();
    expect(!stored?.tags || stored.tags.length === 0).toBe(true);
    // Encrypted replacements must be present
    expect(stored?.encryptedTitle).toBeTruthy();
    expect(stored?.encryptedUsername).toBeTruthy();
    expect(stored?.encryptedUrl).toBeTruthy();
    expect(stored?.encryptedTags).toBeTruthy();
    // isSealed is NOT asserted here — the full seal is sealLegacyMetadata()'s job
  });
});

// ── comment 3324556024 ───────────────────────────────────────────────────────
// update() didn't clear legacy plaintext title/username/url/tags after writing
// the encrypted replacements.

describe('comment 3324556024: update() clears plaintext metadata columns when encrypting them', () => {
  it('encrypting title clears the legacy title column', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    await db.credentials.add({
      id, title: 'OldPlainTitle', encryptedPassword: ep,
      category: 'login' as const, tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { title: 'NewTitle' }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(stored?.title).toBeFalsy();
    expect(stored?.encryptedTitle).toBeTruthy();
  });

  it('encrypting username clears the legacy username column', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    await db.credentials.add({
      id, username: 'old@example.com', encryptedPassword: ep,
      category: 'login' as const, tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { username: 'new@example.com' }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(stored?.username).toBeFalsy();
    expect(stored?.encryptedUsername).toBeTruthy();
  });

  it('encrypting url clears the legacy url column', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    await db.credentials.add({
      id, url: 'https://old.example.com', encryptedPassword: ep,
      category: 'login' as const, tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { url: 'https://new.example.com' }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(stored?.url).toBeFalsy();
    expect(stored?.encryptedUrl).toBeTruthy();
  });

  it('encrypting tags clears the legacy tags array', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    await db.credentials.add({
      id, tags: ['legacy', 'tag'], encryptedPassword: ep,
      category: 'login' as const, isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { tags: ['new'] }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(!stored?.tags || stored.tags.length === 0).toBe(true);
    expect(stored?.encryptedTags).toBeTruthy();
  });
});

// ── comment 3324556049 ───────────────────────────────────────────────────────
// update() didn't clear legacy plaintext card columns after writing encrypted
// replacements.

describe('comment 3324556049: update() clears legacy plaintext card metadata columns', () => {
  it('encrypting cardholderName clears the legacy column', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('', vaultKey));
    await db.credentials.add({
      id, cardholderName: 'Old Name', encryptedPassword: ep,
      category: 'credit_card' as const, tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { cardholderName: 'New Name' }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(stored?.cardholderName).toBeFalsy();
    expect(stored?.encryptedCardholderName).toBeTruthy();
  });

  it('encrypting expiryMonth/Year clears the legacy columns', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('', vaultKey));
    await db.credentials.add({
      id, expiryMonth: '01', expiryYear: '2025', encryptedPassword: ep,
      category: 'credit_card' as const, tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    await repo.update(id, { expiryMonth: '06', expiryYear: '2030' }, vaultKey);

    const stored = await db.credentials.get(id);
    expect(stored?.expiryMonth).toBeFalsy();
    expect(stored?.expiryYear).toBeFalsy();
    expect(stored?.encryptedExpiryMonth).toBeTruthy();
    expect(stored?.encryptedExpiryYear).toBeTruthy();
  });
});

// ── comment 3324556082 ───────────────────────────────────────────────────────
// save() used a fire-and-forget primary-key rewrite; callers calling findById
// immediately after save() could miss the record.

describe('comment 3324556082: save() returns a credential immediately findable by the given id', () => {
  it('a new credential saved with a specific id is findable by that id without any delay', async () => {
    const id = crypto.randomUUID();
    const cred = {
      id,
      title: 'Test Cred',
      username: 'user@example.com',
      password: 'secret',
      category: 'login' as const,
      tags: [] as string[],
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.save(cred, vaultKey);

    // Must be findable immediately — no race or delay
    const found = await repo.findById(id, vaultKey);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(id);
    expect(found?.title).toBe('Test Cred');
  });

  it('saving the same id twice updates the record instead of creating a duplicate', async () => {
    const id = crypto.randomUUID();
    const base = {
      id, title: 'Original', username: 'u', password: 'p',
      category: 'login' as const, tags: [] as string[], isFavorite: false,
      createdAt: new Date(), updatedAt: new Date(),
    };

    await repo.save(base, vaultKey);
    await repo.save({ ...base, title: 'Updated' }, vaultKey);

    const all = await repo.findAll(vaultKey);
    expect(all.length).toBe(1);
    expect(all[0]?.title).toBe('Updated');
  });
});

// ── comment 3324556108 ───────────────────────────────────────────────────────
// exportAll() spread the raw stored row which had encryptedTitle/encryptedUsername
// but no plaintext title/username. importFromJson() fell back to '' for missing
// fields, so export→import round-trip lost all encrypted metadata.

describe('comment 3324556108: export/import round-trip preserves all metadata', () => {
  it('title, username, url, tags survive exportAll → importFromJson', async () => {
    const created = await repo.create(
      {
        title: 'RoundTrip', username: 'rt@example.com',
        password: 'secret', url: 'https://rt.example.com',
        category: 'login', tags: ['rt', 'test'],
      },
      vaultKey
    );

    const exported = await repo.exportAll(vaultKey);

    await db.credentials.clear();

    const count = await repo.importFromJson(exported, vaultKey);
    expect(count).toBe(1);

    const all = await repo.findAll(vaultKey);
    expect(all.length).toBe(1);
    expect(all[0]?.title).toBe('RoundTrip');
    expect(all[0]?.username).toBe('rt@example.com');
    expect(all[0]?.url).toBe('https://rt.example.com');
    expect(all[0]?.tags).toEqual(['rt', 'test']);

    void created; // suppress unused warning
  });
});

// ── comment 3324556176 ───────────────────────────────────────────────────────
// sealLegacyMetadata() didn't clear the plaintext `notes` column when
// `encryptedNotes` was already present, leaving the legacy cleartext in storage.

describe('comment 3324556176: sealLegacyMetadata always clears plaintext notes', () => {
  it('clears notes even when encryptedNotes is already set', async () => {
    const id = crypto.randomUUID();
    const ep = JSON.stringify(await encrypt('pw', vaultKey));
    // Simulate a row where encryptedNotes was added but notes was not cleared
    const encryptedNotes = JSON.stringify(await encrypt('already encrypted', vaultKey));
    await db.credentials.add({
      id,
      title: 'T',
      encryptedPassword: ep,
      notes: 'still plaintext',   // plaintext not cleared yet
      encryptedNotes,             // encrypted version already present
      category: 'login' as const,
      tags: [], isFavorite: false,
      createdAt: Date.now(), updatedAt: Date.now(),
      // isSealed absent → legacy row
    });

    await sealLegacyMetadata(vaultKey);

    const sealed = await db.credentials.get(id);
    expect(sealed?.notes).toBeFalsy();         // plaintext must be cleared
    expect(sealed?.encryptedNotes).toBeTruthy(); // encrypted value preserved
  });
});
