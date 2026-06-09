/**
 * Credential Repository Implementation
 * Implements ICredentialRepository with encrypted storage
 *
 * S5 (SECURITY_PWA_ENHANCEMENT_PLAN.md): all sensitive metadata — title,
 * username, url, tags, and card fields — is stored encrypted with the vault
 * key. Only non-identifying index fields (category, isFavorite, timestamps)
 * remain in plaintext. Pre-v5 records are upgraded by sealLegacyMetadata().
 *
 * Copilot review fixes (PR #34):
 *  3324555923 — update() no longer sets isSealed:true on partial updates
 *  3324556024 — update() clears plaintext title/username/url/tags when encrypting
 *  3324556049 — update() clears plaintext card columns when encrypting
 *  3324556082 — save() uses createWithId() so the caller's id is set synchronously
 *  3324556108 — exportAll() decrypts fully before export so import round-trips work
 */

import { ICredentialRepository } from '@/domain/repositories/ICredentialRepository';
import { Credential, CredentialInput } from '@/domain/entities/Credential';
import { db, type StoredCredential } from '../storage/database';
import { encrypt, decrypt } from '@/core/crypto/encryption';
import { analyzePasswordStrength } from '@/core/crypto/password';

export class CredentialRepository implements ICredentialRepository {

  // ── Private crypto helpers ─────────────────────────────────────────────────

  private async encryptField(value: string, key: CryptoKey): Promise<string> {
    return JSON.stringify(await encrypt(value, key));
  }

  private async encryptOptional(
    value: string | undefined,
    key: CryptoKey
  ): Promise<string | undefined> {
    if (!value) return undefined;
    return this.encryptField(value, key);
  }

  private async decryptField(blob: string, key: CryptoKey): Promise<string> {
    return decrypt(JSON.parse(blob) as Parameters<typeof decrypt>[0], key);
  }

  private async decryptOptional(
    blob: string | undefined,
    key: CryptoKey
  ): Promise<string | undefined> {
    if (!blob) return undefined;
    try { return await this.decryptField(blob, key); }
    catch { return undefined; }
  }

  // ── Internal create with explicit id ──────────────────────────────────────
  // create() generates a UUID; save() passes credential.id directly so there
  // is never a race between the DB write and the caller's findById() call
  // (fixes 3324556082 — primary-key rewrite was fire-and-forget).

  private async createWithId(
    id: string,
    input: CredentialInput,
    encryptionKey: CryptoKey
  ): Promise<Credential> {
    const encryptedPassword       = await this.encryptField(input.password, encryptionKey);
    const encryptedTitle          = await this.encryptField(input.title, encryptionKey);
    const encryptedUsername       = await this.encryptOptional(input.username, encryptionKey);
    const encryptedUrl            = await this.encryptOptional(input.url, encryptionKey);
    const encryptedTags           = (input.tags?.length ?? 0) > 0
      ? await this.encryptField(JSON.stringify(input.tags), encryptionKey)
      : undefined;
    const encryptedNotes          = await this.encryptOptional(input.notes, encryptionKey);
    const encryptedTotpSecret     = await this.encryptOptional(input.totpSecret, encryptionKey);
    const encryptedCardNumber     = await this.encryptOptional(input.cardNumber, encryptionKey);
    const encryptedCvv            = await this.encryptOptional(input.cvv, encryptionKey);
    const encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey);
    const encryptedExpiryMonth    = await this.encryptOptional(input.expiryMonth, encryptionKey);
    const encryptedExpiryYear     = await this.encryptOptional(input.expiryYear, encryptionKey);
    const encryptedCardType       = await this.encryptOptional(input.cardType, encryptionKey);
    const encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey);

    const stored: StoredCredential = {
      id,
      encryptedPassword,
      encryptedTitle, encryptedUsername, encryptedUrl, encryptedTags,
      encryptedNotes, encryptedTotpSecret, encryptedCardNumber, encryptedCvv,
      encryptedCardholderName, encryptedExpiryMonth, encryptedExpiryYear,
      encryptedCardType, encryptedBillingAddress,
      category: input.category,
      tags: [],        // real tags live in encryptedTags
      isFavorite: input.isFavorite ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      securityScore: analyzePasswordStrength(input.password).score,
      isSealed: true,
    };

    await db.credentials.add(stored);
    return this.decryptCredential(stored, encryptionKey);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(input: CredentialInput, encryptionKey: CryptoKey): Promise<Credential> {
    return this.createWithId(crypto.randomUUID(), input, encryptionKey);
  }

  async findById(id: string, decryptionKey: CryptoKey): Promise<Credential | null> {
    const stored = await db.credentials.get(id);
    if (!stored) return null;
    await this.updateAccessTime(id);
    return this.decryptCredential(stored, decryptionKey);
  }

  async findAll(decryptionKey: CryptoKey): Promise<Credential[]> {
    const all = await db.credentials.toArray();
    return Promise.all(all.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async update(
    id: string,
    input: Partial<CredentialInput>,
    encryptionKey: CryptoKey
  ): Promise<Credential> {
    const existing = await db.credentials.get(id);
    if (!existing) throw new Error('Credential not found');

    // Start with only the timestamp.
    // isSealed is preserved from the existing record; it is NOT set to true here
    // for a partial update on a pre-v5 row — sealLegacyMetadata() owns the full
    // sealing lifecycle (fixes 3324555923).
    const updates: Partial<StoredCredential> = {
      updatedAt: Date.now(),
      ...(existing.isSealed ? { isSealed: true } : {}),
    };

    // For each metadata field in the update, write the encrypted version AND
    // clear the legacy plaintext column (fixes 3324556024 and 3324556049).
    if (input.title !== undefined) {
      updates.encryptedTitle = await this.encryptField(input.title, encryptionKey);
      updates.title = undefined;
    }
    if (input.username !== undefined) {
      updates.encryptedUsername = await this.encryptOptional(input.username, encryptionKey);
      updates.username = undefined;
    }
    if (input.url !== undefined) {
      updates.encryptedUrl = await this.encryptOptional(input.url, encryptionKey);
      updates.url = undefined;
    }
    if (input.tags !== undefined) {
      updates.encryptedTags = input.tags.length > 0
        ? await this.encryptField(JSON.stringify(input.tags), encryptionKey)
        : undefined;
      updates.tags = [];
    }
    if (input.category !== undefined) updates.category = input.category;
    if (input.isFavorite !== undefined) updates.isFavorite = input.isFavorite;

    if (input.notes !== undefined) {
      updates.encryptedNotes = await this.encryptOptional(input.notes, encryptionKey);
      updates.notes = undefined;
    }
    if (input.password !== undefined) {
      updates.encryptedPassword = await this.encryptField(input.password, encryptionKey);
      updates.securityScore = analyzePasswordStrength(input.password).score;
    }
    if (input.totpSecret !== undefined)
      updates.encryptedTotpSecret = await this.encryptOptional(input.totpSecret, encryptionKey);
    if (input.cardNumber !== undefined)
      updates.encryptedCardNumber = await this.encryptOptional(input.cardNumber, encryptionKey);
    if (input.cvv !== undefined)
      updates.encryptedCvv = await this.encryptOptional(input.cvv, encryptionKey);

    // Card metadata — encrypt AND clear plaintext counterpart (fixes 3324556049)
    if (input.cardholderName !== undefined) {
      updates.encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey);
      updates.cardholderName = undefined;
    }
    if (input.expiryMonth !== undefined) {
      updates.encryptedExpiryMonth = await this.encryptOptional(input.expiryMonth, encryptionKey);
      updates.expiryMonth = undefined;
    }
    if (input.expiryYear !== undefined) {
      updates.encryptedExpiryYear = await this.encryptOptional(input.expiryYear, encryptionKey);
      updates.expiryYear = undefined;
    }
    if (input.cardType !== undefined) {
      updates.encryptedCardType = await this.encryptOptional(input.cardType, encryptionKey);
      updates.cardType = undefined;
    }
    if (input.billingAddress !== undefined) {
      updates.encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey);
      updates.billingAddress = undefined;
    }

    await db.credentials.update(id, updates);
    const updated = await db.credentials.get(id);
    if (!updated) throw new Error('Credential not found after update');
    return this.decryptCredential(updated, encryptionKey);
  }

  async delete(id: string): Promise<void> {
    await db.credentials.delete(id);
  }

  async search(query: string, decryptionKey: CryptoKey): Promise<Credential[]> {
    const all = await this.findAll(decryptionKey);
    const lq = query.toLowerCase();
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(lq) ||
        (c.username ?? '').toLowerCase().includes(lq) ||
        (c.url ?? '').toLowerCase().includes(lq) ||
        c.tags.some((t) => t.toLowerCase().includes(lq))
    );
  }

  async findByCategory(category: string, decryptionKey: CryptoKey): Promise<Credential[]> {
    const stored = await db.credentials.where('category').equals(category).toArray();
    return Promise.all(stored.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async findFavorites(decryptionKey: CryptoKey): Promise<Credential[]> {
    const stored = await db.credentials.where('isFavorite').equals(1).toArray();
    return Promise.all(stored.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async exportAll(decryptionKey: CryptoKey): Promise<string> {
    // Fully decrypt before export so that importFromJson() receives plaintext
    // title/username/url/tags rather than the encrypted blobs (fixes 3324556108).
    const credentials = await this.findAll(decryptionKey);
    const exportable = credentials.map((c) => ({
      id: c.id,
      title: c.title,
      username: c.username,
      password: c.password !== '[Decryption Failed]' ? c.password : undefined,
      url: c.url,
      notes: c.notes,
      category: c.category,
      tags: c.tags,
      isFavorite: c.isFavorite,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      totpSecret: c.totpSecret,
      cardNumber: c.cardNumber,
      cardholderName: c.cardholderName,
      expiryMonth: c.expiryMonth,
      expiryYear: c.expiryYear,
      cvv: c.cvv,
      cardType: c.cardType,
      billingAddress: c.billingAddress,
      securityScore: c.securityScore,
    }));
    return JSON.stringify(exportable, null, 2);
  }

  async importFromJson(data: string, encryptionKey: CryptoKey): Promise<number> {
    // S8: schema-validate BEFORE any row touches the repository. Throws a
    // user-facing error on malformed/oversized/wrong-shaped payloads.
    const { parseImportPayload } = await import('@/data/repositories/importValidation');
    const parsed = parseImportPayload(data);

    let imported = 0;
    for (const item of parsed) {
      try {
        await this.create(
          {
            title: item.title ?? '',
            username: item.username ?? '',
            password: item.password ?? '',
            url: item.url,
            notes: item.notes,
            category: item.category ?? 'login',
            tags: item.tags ?? [],
            isFavorite: item.isFavorite ?? false,
            totpSecret: item.totpSecret,
            cardNumber: item.cardNumber,
            cardholderName: item.cardholderName,
            expiryMonth: item.expiryMonth,
            expiryYear: item.expiryYear,
            cvv: item.cvv,
            cardType: item.cardType,
            billingAddress: item.billingAddress,
          },
          encryptionKey
        );
        imported++;
      } catch {
        // skip bad rows
      }
    }
    return imported;
  }

  async updateAccessTime(id: string): Promise<void> {
    await db.credentials.update(id, { lastAccessedAt: Date.now() });
  }

  async analyzeSecurityScore(id: string, decryptionKey: CryptoKey): Promise<number> {
    const credential = await db.credentials.get(id);
    if (!credential) throw new Error('Credential not found');
    try {
      const password = await this.decryptField(credential.encryptedPassword, decryptionKey);
      const analysis = analyzePasswordStrength(password);
      await db.credentials.update(id, { securityScore: analysis.score });
      return analysis.score;
    } catch {
      return 0;
    }
  }

  // ── Decrypt a stored row into a domain Credential ─────────────────────────

  async decryptCredential(stored: StoredCredential, vaultKey: CryptoKey): Promise<Credential> {
    try {
      const password = await this.decryptField(stored.encryptedPassword, vaultKey);

      const title = stored.encryptedTitle
        ? await this.decryptField(stored.encryptedTitle, vaultKey)
        : (stored.title ?? '');

      const username = stored.encryptedUsername
        ? await this.decryptField(stored.encryptedUsername, vaultKey)
        : (stored.username ?? '');

      const url = stored.encryptedUrl
        ? await this.decryptField(stored.encryptedUrl, vaultKey)
        : stored.url;

      let tags: string[] = stored.tags ?? [];
      if (stored.encryptedTags) {
        try {
          tags = JSON.parse(
            await this.decryptField(stored.encryptedTags, vaultKey)
          ) as string[];
        } catch {
          // keep legacy tags
        }
      }

      let notes: string | undefined;
      if (stored.encryptedNotes) {
        try { notes = await this.decryptField(stored.encryptedNotes, vaultKey); }
        catch { notes = stored.notes; }
      } else {
        notes = stored.notes;
      }

      const totpSecret = await this.decryptOptional(stored.encryptedTotpSecret, vaultKey);
      const cardNumber = await this.decryptOptional(stored.encryptedCardNumber, vaultKey);
      const cvv        = await this.decryptOptional(stored.encryptedCvv, vaultKey);

      const cardholderName = stored.encryptedCardholderName
        ? await this.decryptOptional(stored.encryptedCardholderName, vaultKey)
        : stored.cardholderName;
      const expiryMonth = stored.encryptedExpiryMonth
        ? await this.decryptOptional(stored.encryptedExpiryMonth, vaultKey)
        : stored.expiryMonth;
      const expiryYear = stored.encryptedExpiryYear
        ? await this.decryptOptional(stored.encryptedExpiryYear, vaultKey)
        : stored.expiryYear;
      const cardType = stored.encryptedCardType
        ? (await this.decryptOptional(stored.encryptedCardType, vaultKey)) as Credential['cardType']
        : stored.cardType;
      const billingAddress = stored.encryptedBillingAddress
        ? await this.decryptOptional(stored.encryptedBillingAddress, vaultKey)
        : stored.billingAddress;

      return {
        id: stored.id, title, username, password, url, notes,
        category: stored.category, tags,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
        lastAccessedAt: stored.lastAccessedAt ? new Date(stored.lastAccessedAt) : undefined,
        isFavorite: stored.isFavorite,
        securityScore: stored.securityScore,
        totpSecret, cardNumber, cardholderName, expiryMonth, expiryYear,
        cvv, cardType, billingAddress,
      };
    } catch {
      return {
        id: stored.id,
        title: stored.title ?? '',
        username: stored.username ?? '',
        password: '[Decryption Failed]',
        url: stored.url,
        notes: stored.notes,
        category: stored.category,
        tags: stored.tags ?? [],
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
        lastAccessedAt: stored.lastAccessedAt ? new Date(stored.lastAccessedAt) : undefined,
        isFavorite: stored.isFavorite,
        securityScore: stored.securityScore,
      };
    }
  }

  // ── save() — backward-compat convenience (uses createWithId for new records)

  async save(credential: Credential, encryptionKey: CryptoKey): Promise<Credential> {
    const existing = await db.credentials.get(credential.id);

    if (existing) {
      return this.update(
        credential.id,
        {
          title: credential.title,
          username: credential.username,
          password: credential.password,
          url: credential.url,
          notes: credential.notes,
          category: credential.category,
          tags: credential.tags,
          isFavorite: credential.isFavorite,
          totpSecret: credential.totpSecret,
          cardNumber: credential.cardNumber,
          cardholderName: credential.cardholderName,
          expiryMonth: credential.expiryMonth,
          expiryYear: credential.expiryYear,
          cvv: credential.cvv,
          cardType: credential.cardType,
          billingAddress: credential.billingAddress,
        },
        encryptionKey
      );
    }

    // New record: use createWithId so the row is immediately findable by
    // credential.id — no async primary-key rewrite needed (fixes 3324556082).
    return this.createWithId(
      credential.id,
      {
        title: credential.title,
        username: credential.username ?? '',
        password: credential.password ?? '',
        url: credential.url,
        notes: credential.notes,
        category: credential.category,
        tags: credential.tags ?? [],
        isFavorite: credential.isFavorite,
        totpSecret: credential.totpSecret,
        cardNumber: credential.cardNumber,
        cardholderName: credential.cardholderName,
        expiryMonth: credential.expiryMonth,
        expiryYear: credential.expiryYear,
        cvv: credential.cvv,
        cardType: credential.cardType,
        billingAddress: credential.billingAddress,
      },
      encryptionKey
    );
  }
}

export const credentialRepository = new CredentialRepository();
