/**
 * Credential Repository Implementation
 * Implements ICredentialRepository with encrypted storage
 *
 * S5 (SECURITY_PWA_ENHANCEMENT_PLAN.md): all sensitive metadata — title,
 * username, url, tags, and card fields — is stored encrypted with the vault
 * key. Only non-identifying index fields (category, isFavorite, timestamps)
 * remain in plaintext. Pre-v5 records are upgraded by sealLegacyMetadata().
 */

import { ICredentialRepository } from '@/domain/repositories/ICredentialRepository';
import { Credential, CredentialInput } from '@/domain/entities/Credential';
import { db, type StoredCredential } from '../storage/database';
import { encrypt, decrypt } from '@/core/crypto/encryption';
import { analyzePasswordStrength } from '@/core/crypto/password';

export class CredentialRepository implements ICredentialRepository {

  // ── Private helpers ────────────────────────────────────────────────────────

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
    try {
      return await this.decryptField(blob, key);
    } catch {
      return undefined;
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(input: CredentialInput, encryptionKey: CryptoKey): Promise<Credential> {
    // Core secret
    const encryptedPassword = await this.encryptField(input.password, encryptionKey);

    // Sensitive metadata — S5: never stored in plaintext
    const encryptedTitle    = await this.encryptField(input.title, encryptionKey);
    const encryptedUsername = await this.encryptOptional(input.username, encryptionKey);
    const encryptedUrl      = await this.encryptOptional(input.url, encryptionKey);
    const encryptedTags     = (input.tags?.length ?? 0) > 0
      ? await this.encryptField(JSON.stringify(input.tags), encryptionKey)
      : undefined;

    // Other encrypted fields
    const encryptedNotes      = await this.encryptOptional(input.notes, encryptionKey);
    const encryptedTotpSecret = await this.encryptOptional(input.totpSecret, encryptionKey);
    const encryptedCardNumber = await this.encryptOptional(input.cardNumber, encryptionKey);
    const encryptedCvv        = await this.encryptOptional(input.cvv, encryptionKey);

    // Card metadata (newly encrypted in v5)
    const encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey);
    const encryptedExpiryMonth    = await this.encryptOptional(input.expiryMonth, encryptionKey);
    const encryptedExpiryYear     = await this.encryptOptional(input.expiryYear, encryptionKey);
    const encryptedCardType       = await this.encryptOptional(input.cardType, encryptionKey);
    const encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey);

    const stored: StoredCredential = {
      id: crypto.randomUUID(),
      encryptedPassword,
      encryptedTitle,
      encryptedUsername,
      encryptedUrl,
      encryptedTags,
      encryptedNotes,
      encryptedTotpSecret,
      encryptedCardNumber,
      encryptedCvv,
      encryptedCardholderName,
      encryptedExpiryMonth,
      encryptedExpiryYear,
      encryptedCardType,
      encryptedBillingAddress,
      // Plaintext index fields (non-sensitive)
      category: input.category,
      tags: [],       // real tags are in encryptedTags
      isFavorite: input.isFavorite ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      securityScore: analyzePasswordStrength(input.password).score,
      isSealed: true,
    };

    await db.credentials.add(stored);
    return this.decryptCredential(stored, encryptionKey);
  }

  async findById(id: string, decryptionKey: CryptoKey): Promise<Credential | null> {
    const stored = await db.credentials.get(id);
    if (!stored) return null;
    await this.updateAccessTime(id);
    return this.decryptCredential(stored, decryptionKey);
  }

  async findAll(decryptionKey: CryptoKey): Promise<Credential[]> {
    const storedCredentials = await db.credentials.toArray();
    return Promise.all(storedCredentials.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async update(
    id: string,
    input: Partial<CredentialInput>,
    encryptionKey: CryptoKey
  ): Promise<Credential> {
    const existing = await db.credentials.get(id);
    if (!existing) throw new Error('Credential not found');

    const updates: Partial<StoredCredential> = { updatedAt: Date.now(), isSealed: true };

    if (input.title !== undefined)
      updates.encryptedTitle = await this.encryptField(input.title, encryptionKey);
    if (input.username !== undefined)
      updates.encryptedUsername = await this.encryptOptional(input.username, encryptionKey);
    if (input.url !== undefined)
      updates.encryptedUrl = await this.encryptOptional(input.url, encryptionKey);
    if (input.tags !== undefined)
      updates.encryptedTags = (input.tags.length > 0)
        ? await this.encryptField(JSON.stringify(input.tags), encryptionKey)
        : undefined;
    if (input.category !== undefined) updates.category = input.category;
    if (input.isFavorite !== undefined) updates.isFavorite = input.isFavorite;

    if (input.notes !== undefined) {
      updates.encryptedNotes = await this.encryptOptional(input.notes, encryptionKey);
      updates.notes = undefined; // clear legacy plaintext
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
    if (input.cardholderName !== undefined)
      updates.encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey);
    if (input.expiryMonth !== undefined)
      updates.encryptedExpiryMonth = await this.encryptOptional(input.expiryMonth, encryptionKey);
    if (input.expiryYear !== undefined)
      updates.encryptedExpiryYear = await this.encryptOptional(input.expiryYear, encryptionKey);
    if (input.cardType !== undefined)
      updates.encryptedCardType = await this.encryptOptional(input.cardType, encryptionKey);
    if (input.billingAddress !== undefined)
      updates.encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey);

    await db.credentials.update(id, updates);
    const updated = await db.credentials.get(id);
    if (!updated) throw new Error('Credential not found after update');
    return this.decryptCredential(updated, encryptionKey);
  }

  async delete(id: string): Promise<void> {
    await db.credentials.delete(id);
  }

  async search(query: string, decryptionKey: CryptoKey): Promise<Credential[]> {
    // Full-scan: decrypt everything in memory, then filter.
    // search() already worked this way before v5 (fetched all rows, filtered client-side).
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
    // category index still works (it's a non-sensitive field kept in plaintext)
    const stored = await db.credentials.where('category').equals(category).toArray();
    return Promise.all(stored.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async findFavorites(decryptionKey: CryptoKey): Promise<Credential[]> {
    const stored = await db.credentials.where('isFavorite').equals(1).toArray();
    return Promise.all(stored.map((c) => this.decryptCredential(c, decryptionKey)));
  }

  async exportAll(decryptionKey: CryptoKey): Promise<string> {
    const credentials = await db.credentials.toArray();
    const decrypted = await Promise.all(
      credentials.map(async (c) => {
        try {
          const password = await this.decryptField(c.encryptedPassword, decryptionKey);
          return { ...c, password, encryptedPassword: undefined };
        } catch {
          return { ...c, password: '[DECRYPTION_FAILED]', encryptedPassword: undefined };
        }
      })
    );
    return JSON.stringify(decrypted, null, 2);
  }

  async importFromJson(data: string, encryptionKey: CryptoKey): Promise<number> {
    try {
      const parsed = JSON.parse(data) as Array<
        Omit<StoredCredential, 'encryptedPassword'> & { password: string }
      >;
      let imported = 0;
      for (const item of parsed) {
        try {
          await this.create(
            {
              title: item.title ?? '',
              username: item.username ?? '',
              password: item.password,
              url: item.url ?? undefined,
              notes: item.notes ?? undefined,
              category: item.category,
              tags: item.tags ?? [],
            },
            encryptionKey
          );
          imported++;
        } catch {
          // skip bad rows, continue import
        }
      }
      return imported;
    } catch {
      throw new Error('Invalid import data format');
    }
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

  // ── Private: decrypt a stored row into a domain Credential ────────────────

  async decryptCredential(stored: StoredCredential, vaultKey: CryptoKey): Promise<Credential> {
    try {
      const password = await this.decryptField(stored.encryptedPassword, vaultKey);

      // Title: try encrypted first, fall back to legacy plaintext for unsealed rows
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
          const tagsJson = await this.decryptField(stored.encryptedTags, vaultKey);
          tags = JSON.parse(tagsJson) as string[];
        } catch {
          // fall back to legacy plaintext tags
        }
      }

      // Notes: try encrypted, then legacy plaintext
      let notes: string | undefined;
      if (stored.encryptedNotes) {
        try {
          notes = await this.decryptField(stored.encryptedNotes, vaultKey);
        } catch {
          notes = stored.notes;
        }
      } else {
        notes = stored.notes;
      }

      const totpSecret   = await this.decryptOptional(stored.encryptedTotpSecret, vaultKey);
      const cardNumber   = await this.decryptOptional(stored.encryptedCardNumber, vaultKey);
      const cvv          = await this.decryptOptional(stored.encryptedCvv, vaultKey);

      // Card metadata: encrypted v5 fields take precedence over legacy plaintext
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
        id: stored.id,
        title,
        username,
        password,
        url,
        notes,
        category: stored.category,
        tags,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
        lastAccessedAt: stored.lastAccessedAt ? new Date(stored.lastAccessedAt) : undefined,
        isFavorite: stored.isFavorite,
        securityScore: stored.securityScore,
        totpSecret,
        cardNumber,
        cardholderName,
        expiryMonth,
        expiryYear,
        cvv,
        cardType,
        billingAddress,
      };
    } catch {
      // Decryption failed (wrong key or corrupt data) — return safe placeholder
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

  // ── save() — backward-compat convenience method ────────────────────────────

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

    // New record via save() — route through create() for consistent encryption
    return this.create(
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
    ).then((created) => {
      // save() must honour the caller's id — swap it in the stored record
      if (created.id !== credential.id) {
        void db.credentials
          .where('id').equals(created.id)
          .modify({ id: credential.id })
          .catch(() => {/* ignore — id already matches */});
        created = { ...created, id: credential.id };
      }
      return created;
    });
  }
}

export const credentialRepository = new CredentialRepository();
