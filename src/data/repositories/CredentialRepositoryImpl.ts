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
import { decrypt } from '@/core/crypto/encryption';
import type { CredentialField } from '@/core/crypto/aad';
import { IntegrityError, isV2Row, openRow, resealRow, sealField } from './credentialRowCrypto';
import { commitRowIfUnchanged } from './rowCommit';
import { analyzePasswordStrength } from '@/core/crypto/password';
import { saveBreachPrefix, deleteBreachPrefix } from '@/core/breach/breachPrefixStore';

export class CredentialRepository implements ICredentialRepository {

  // ── Private crypto helpers ─────────────────────────────────────────────────

  private async encryptOptional(
    value: string | undefined,
    key: CryptoKey,
    userId: string,
    recordId: string,
    field: CredentialField
  ): Promise<string | undefined> {
    if (!value) return undefined;
    return sealField(value, key, userId, recordId, field);
  }

  /** Legacy (pre-AAD) rows only; v2 rows are read through openRow(). */
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

  // ── Per-user partitioning helpers (v9, Finding 1) ─────────────────────────

  /**
   * Ownership probe for a legacy (pre-v9) row without a userId: AES-256-GCM
   * decryption of the password blob only succeeds with the owner's vault key
   * (auth-tag failure throws), so a successful decrypt is cryptographic proof
   * of ownership.
   */
  private async canClaim(stored: StoredCredential, key: CryptoKey, userId: string): Promise<boolean> {
    try {
      await this.readPassword(stored, key, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async readPassword(stored: StoredCredential, key: CryptoKey, userId: string): Promise<string> {
    if (!isV2Row(stored)) return this.decryptField(stored.encryptedPassword, key);
    const { encryptedPassword } = await openRow(stored, key, userId);
    return encryptedPassword as string;
  }

  /**
   * Claims every unowned row the caller's key decrypts (writes userId) and
   * returns the claimed rows. Rows the key cannot decrypt are skipped silently.
   */
  private async claimDecryptable(
    unowned: StoredCredential[],
    userId: string,
    key: CryptoKey
  ): Promise<StoredCredential[]> {
    const claimed: StoredCredential[] = [];
    for (const stored of unowned) {
      if (await this.canClaim(stored, key, userId)) {
        await db.credentials.update(stored.id, { userId });
        claimed.push({ ...stored, userId });
      }
    }
    return claimed;
  }

  /**
   * All rows the user owns, plus any legacy unowned rows their key decrypts
   * (lazily claimed as a side effect).
   */
  private async getOwnedAndClaimable(
    userId: string,
    key: CryptoKey
  ): Promise<StoredCredential[]> {
    const owned = await db.credentials.where('userId').equals(userId).toArray();
    const unowned = await db.credentials.filter((c) => c.userId === undefined).toArray();
    const claimed = await this.claimDecryptable(unowned, userId, key);
    return [...owned, ...claimed];
  }

  // ── Internal create with explicit id ──────────────────────────────────────
  // create() generates a UUID; save() passes credential.id directly so there
  // is never a race between the DB write and the caller's findById() call
  // (fixes 3324556082 — primary-key rewrite was fire-and-forget).

  private async createWithId(
    id: string,
    input: CredentialInput,
    encryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential> {
    const encryptedPassword       = await sealField(input.password, encryptionKey, userId, id, 'encryptedPassword');
    const encryptedTitle          = await sealField(input.title, encryptionKey, userId, id, 'encryptedTitle');
    const encryptedUsername       = await this.encryptOptional(input.username, encryptionKey, userId, id, 'encryptedUsername');
    const encryptedUrl            = await this.encryptOptional(input.url, encryptionKey, userId, id, 'encryptedUrl');
    const encryptedTags           = (input.tags?.length ?? 0) > 0
      ? await sealField(JSON.stringify(input.tags), encryptionKey, userId, id, 'encryptedTags')
      : undefined;
    const encryptedNotes          = await this.encryptOptional(input.notes, encryptionKey, userId, id, 'encryptedNotes');
    const encryptedTotpSecret     = await this.encryptOptional(input.totpSecret, encryptionKey, userId, id, 'encryptedTotpSecret');
    const encryptedCardNumber     = await this.encryptOptional(input.cardNumber, encryptionKey, userId, id, 'encryptedCardNumber');
    const encryptedCvv            = await this.encryptOptional(input.cvv, encryptionKey, userId, id, 'encryptedCvv');
    const encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey, userId, id, 'encryptedCardholderName');
    const encryptedExpiryMonth    = await this.encryptOptional(input.expiryMonth, encryptionKey, userId, id, 'encryptedExpiryMonth');
    const encryptedExpiryYear     = await this.encryptOptional(input.expiryYear, encryptionKey, userId, id, 'encryptedExpiryYear');
    const encryptedCardType       = await this.encryptOptional(input.cardType, encryptionKey, userId, id, 'encryptedCardType');
    const encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey, userId, id, 'encryptedBillingAddress');

    // Encrypt backup codes if present
    let encryptedBackupCodes: string | undefined;
    if (input.backupCodes && input.backupCodes.length > 0) {
      const codesJson = JSON.stringify(input.backupCodes);
      encryptedBackupCodes = await sealField(codesJson, encryptionKey, userId, id, 'encryptedBackupCodes');
    }

    const stored: StoredCredential = {
      id,
      userId,
      profileId,
      encryptedPassword,
      encryptedTitle, encryptedUsername, encryptedUrl, encryptedTags,
      encryptedNotes, encryptedTotpSecret, encryptedCardNumber, encryptedCvv,
      encryptedCardholderName, encryptedExpiryMonth, encryptedExpiryYear,
      encryptedCardType, encryptedBillingAddress, encryptedBackupCodes,
      category: input.category,
      tags: [],        // real tags live in encryptedTags
      isFavorite: input.isFavorite ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      securityScore: analyzePasswordStrength(input.password).score,
      isSealed: true,
    };

    await db.credentials.add(stored);
    // P4: keep the HIBP prefix store in sync (never blocks/breaks CRUD).
    await saveBreachPrefix(id, input.password, userId);
    return this.decryptCredential(stored, encryptionKey, userId);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(
    input: CredentialInput,
    encryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential> {
    return this.createWithId(crypto.randomUUID(), input, encryptionKey, userId, profileId);
  }

  async findById(
    id: string,
    decryptionKey: CryptoKey,
    userId: string
  ): Promise<Credential | null> {
    const stored = await db.credentials.get(id);
    if (!stored) return null;
    // Owned by someone else → invisible to this user.
    if (stored.userId !== undefined && stored.userId !== userId) return null;
    // Legacy unowned row → claim only on cryptographic proof of ownership.
    if (stored.userId === undefined) {
      if (!(await this.canClaim(stored, decryptionKey, userId))) return null;
      await db.credentials.update(id, { userId });
    }
    await this.updateAccessTime(id, userId);
    return this.decryptCredential(stored, decryptionKey, userId);
  }

  async findAll(
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]> {
    let rows = await this.getOwnedAndClaimable(userId, decryptionKey);
    if (profileId !== undefined) {
      rows = rows.filter((c) => c.profileId === profileId);
    }
    return Promise.all(rows.map((c) => this.decryptCredential(c, decryptionKey, userId)));
  }

  async update(
    id: string,
    input: Partial<CredentialInput>,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<Credential> {
    const existing = await db.credentials.get(id);
    // Identical message for "missing" and "not yours" — no existence oracle.
    if (!existing || (existing.userId !== undefined && existing.userId !== userId)) {
      throw new Error('Credential not found');
    }
    // Legacy unowned row: updating requires cryptographic proof of ownership.
    if (existing.userId === undefined && !(await this.canClaim(existing, encryptionKey, userId))) {
      throw new Error('Credential not found');
    }

    // The whole row must be authentic and v2 before any partial write, so a
    // failed row is never overwritten and no legacy column is stranded.
    await this.requireAuthenticV2Row(id, encryptionKey, userId);

    // Start with only the timestamp.
    // isSealed is never set by a partial update on its own: sealLegacyMetadata()
    // owns the sealing lifecycle (fixes 3324555923).
    const updates: Partial<StoredCredential> = {
      updatedAt: Date.now(),
      userId, // claims legacy unowned rows (ownership proven above)
      ...(existing.isSealed ? { isSealed: true } : {}),
    };

    // For each metadata field in the update, write the encrypted version AND
    // clear the legacy plaintext column (fixes 3324556024 and 3324556049).
    if (input.title !== undefined) {
      updates.encryptedTitle = await sealField(input.title, encryptionKey, userId, id, 'encryptedTitle');
      updates.title = undefined;
    }
    if (input.username !== undefined) {
      updates.encryptedUsername = await this.encryptOptional(input.username, encryptionKey, userId, id, 'encryptedUsername');
      updates.username = undefined;
    }
    if (input.url !== undefined) {
      updates.encryptedUrl = await this.encryptOptional(input.url, encryptionKey, userId, id, 'encryptedUrl');
      updates.url = undefined;
    }
    if (input.tags !== undefined) {
      updates.encryptedTags = input.tags.length > 0
        ? await sealField(JSON.stringify(input.tags), encryptionKey, userId, id, 'encryptedTags')
        : undefined;
      updates.tags = [];
    }
    if (input.category !== undefined) updates.category = input.category;
    if (input.isFavorite !== undefined) updates.isFavorite = input.isFavorite;

    if (input.notes !== undefined) {
      updates.encryptedNotes = await this.encryptOptional(input.notes, encryptionKey, userId, id, 'encryptedNotes');
      updates.notes = undefined;
    }
    if (input.password !== undefined) {
      updates.encryptedPassword = await sealField(input.password, encryptionKey, userId, id, 'encryptedPassword');
      updates.securityScore = analyzePasswordStrength(input.password).score;
      // P4: refresh the HIBP prefix for the new password.
      await saveBreachPrefix(id, input.password, userId);
    }
    if (input.totpSecret !== undefined)
      updates.encryptedTotpSecret = await this.encryptOptional(input.totpSecret, encryptionKey, userId, id, 'encryptedTotpSecret');
    if (input.cardNumber !== undefined)
      updates.encryptedCardNumber = await this.encryptOptional(input.cardNumber, encryptionKey, userId, id, 'encryptedCardNumber');
    if (input.cvv !== undefined)
      updates.encryptedCvv = await this.encryptOptional(input.cvv, encryptionKey, userId, id, 'encryptedCvv');

    // Card metadata — encrypt AND clear plaintext counterpart (fixes 3324556049)
    if (input.cardholderName !== undefined) {
      updates.encryptedCardholderName = await this.encryptOptional(input.cardholderName, encryptionKey, userId, id, 'encryptedCardholderName');
      updates.cardholderName = undefined;
    }
    if (input.expiryMonth !== undefined) {
      updates.encryptedExpiryMonth = await this.encryptOptional(input.expiryMonth, encryptionKey, userId, id, 'encryptedExpiryMonth');
      updates.expiryMonth = undefined;
    }
    if (input.expiryYear !== undefined) {
      updates.encryptedExpiryYear = await this.encryptOptional(input.expiryYear, encryptionKey, userId, id, 'encryptedExpiryYear');
      updates.expiryYear = undefined;
    }
    if (input.cardType !== undefined) {
      updates.encryptedCardType = await this.encryptOptional(input.cardType, encryptionKey, userId, id, 'encryptedCardType');
      updates.cardType = undefined;
    }
    if (input.billingAddress !== undefined) {
      updates.encryptedBillingAddress = await this.encryptOptional(input.billingAddress, encryptionKey, userId, id, 'encryptedBillingAddress');
      updates.billingAddress = undefined;
    }
    if (input.backupCodes !== undefined) {
      if (input.backupCodes.length > 0) {
        const codesJson = JSON.stringify(input.backupCodes);
        updates.encryptedBackupCodes = await sealField(codesJson, encryptionKey, userId, id, 'encryptedBackupCodes');
      } else {
        updates.encryptedBackupCodes = undefined;
      }
    }

    await db.credentials.update(id, updates);
    const updated = await db.credentials.get(id);
    if (!updated) throw new Error('Credential not found after update');
    return this.decryptCredential(updated, encryptionKey, userId);
  }

  /**
   * Upgrades a legacy row in its own guarded write, so the caller's partial
   * write then touches only the fields it changes. If another writer got there
   * first, the row is re-read instead of being overwritten with stale columns.
   */
  private async requireAuthenticV2Row(id: string, key: CryptoKey, userId: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await db.credentials.get(id);
      if (!row) throw new Error('Credential not found');
      if (isV2Row(row)) {
        await openRow(row, key, userId);
        return;
      }
      await commitRowIfUnchanged(row, await resealRow(row, key, userId));
    }
    throw new IntegrityError();
  }

  async delete(id: string, decryptionKey: CryptoKey, userId: string): Promise<void> {
    const existing = await db.credentials.get(id);
    // Identical message for "missing" and "not yours" — no existence oracle.
    if (!existing || (existing.userId !== undefined && existing.userId !== userId)) {
      throw new Error('Credential not found');
    }
    // Legacy unowned row: deleting requires cryptographic proof of ownership
    // (mirrors update()); identical error so failure leaks no existence info.
    if (existing.userId === undefined && !(await this.canClaim(existing, decryptionKey, userId))) {
      throw new Error('Credential not found');
    }
    await db.credentials.delete(id);
    // P4: remove the credential's HIBP prefix row.
    await deleteBreachPrefix(id);
  }

  async search(
    query: string,
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]> {
    const all = await this.findAll(decryptionKey, userId, profileId);
    const lq = query.toLowerCase();
    return all.filter(
      (c) =>
        c.title.toLowerCase().includes(lq) ||
        (c.username ?? '').toLowerCase().includes(lq) ||
        (c.url ?? '').toLowerCase().includes(lq) ||
        c.tags.some((t) => t.toLowerCase().includes(lq))
    );
  }

  async findByCategory(
    category: string,
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]> {
    const owned = await db.credentials
      .where('[userId+category]')
      .equals([userId, category])
      .toArray();
    const unowned = await db.credentials
      .filter((c) => c.userId === undefined && c.category === category)
      .toArray();
    const claimed = await this.claimDecryptable(unowned, userId, decryptionKey);
    let rows = [...owned, ...claimed];
    if (profileId !== undefined) {
      rows = rows.filter((c) => c.profileId === profileId);
    }
    return Promise.all(rows.map((c) => this.decryptCredential(c, decryptionKey, userId)));
  }

  async findFavorites(
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]> {
    // Booleans are not valid IndexedDB keys, so isFavorite is filtered in
    // memory over the user's (already scoped) rows.
    let rows = await this.getOwnedAndClaimable(userId, decryptionKey);
    rows = rows.filter((c) => c.isFavorite);
    if (profileId !== undefined) {
      rows = rows.filter((c) => c.profileId === profileId);
    }
    return Promise.all(rows.map((c) => this.decryptCredential(c, decryptionKey, userId)));
  }

  async exportAll(decryptionKey: CryptoKey, userId: string): Promise<string> {
    // Fully decrypt before export so that importFromJson() receives plaintext
    // title/username/url/tags rather than the encrypted blobs (fixes 3324556108).
    const credentials = await this.findAll(decryptionKey, userId);
    const exportable = credentials.filter((c) => !c.integrityError).map((c) => ({
      id: c.id,
      title: c.title,
      username: c.username,
      password: c.password,
      url: c.url,
      notes: c.notes,
      category: c.category,
      tags: c.tags,
      isFavorite: c.isFavorite,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      totpSecret: c.totpSecret,
      backupCodes: c.backupCodes,
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

  async importFromJson(
    data: string,
    encryptionKey: CryptoKey,
    userId: string,
    mode: 'append' | 'merge' = 'append'
  ): Promise<number> {
    // S8: schema-validate BEFORE any row touches the repository. Throws a
    // user-facing error on malformed/oversized/wrong-shaped payloads.
    const { parseImportPayload } = await import('@/data/repositories/importValidation');
    const parsed = parseImportPayload(data);

    // 'merge' mode: skip rows matching an existing credential's title+username
    // (case-insensitive), mirroring ImportDialog.tsx's UI-layer dedupe.
    let existingKeys: Set<string> | null = null;
    if (mode === 'merge') {
      const existing = await this.findAll(encryptionKey, userId);
      existingKeys = new Set(
        existing.map((c) => `${c.title.toLowerCase()}\u0000${c.username.toLowerCase()}`)
      );
    }

    let imported = 0;
    for (const item of parsed) {
      if (existingKeys) {
        const key = `${(item.title ?? '').toLowerCase()}\u0000${(item.username ?? '').toLowerCase()}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key); // dedupe within the import payload itself too
      }

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
            backupCodes: item.backupCodes,
            cardNumber: item.cardNumber,
            cardholderName: item.cardholderName,
            expiryMonth: item.expiryMonth,
            expiryYear: item.expiryYear,
            cvv: item.cvv,
            cardType: item.cardType,
            billingAddress: item.billingAddress,
          },
          encryptionKey,
          userId
        );
        imported++;
      } catch {
        // skip bad rows
      }
    }
    return imported;
  }

  async updateAccessTime(id: string, userId: string): Promise<void> {
    const stored = await db.credentials.get(id);
    // Never touch rows owned by another user (legacy unowned rows are
    // claimed elsewhere via decryption proof; a timestamp touch is harmless).
    if (!stored || (stored.userId !== undefined && stored.userId !== userId)) return;
    await db.credentials.update(id, { lastAccessedAt: Date.now() });
  }

  async analyzeSecurityScore(id: string, decryptionKey: CryptoKey, userId: string): Promise<number> {
    const credential = await db.credentials.get(id);
    // Identical message for "missing" and "not yours" — no existence oracle.
    if (!credential || (credential.userId !== undefined && credential.userId !== userId)) {
      throw new Error('Credential not found');
    }
    try {
      const password = await this.readPassword(credential, decryptionKey, userId);
      const analysis = analyzePasswordStrength(password);
      await db.credentials.update(id, { securityScore: analysis.score });
      return analysis.score;
    } catch {
      return 0;
    }
  }

  private rowMeta(stored: StoredCredential) {
    return {
      id: stored.id,
      category: stored.category,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      lastAccessedAt: stored.lastAccessedAt ? new Date(stored.lastAccessedAt) : undefined,
      isFavorite: stored.isFavorite,
    };
  }

  /** What a row that fails to decrypt yields: no secrets, no URL, no plaintext columns. */
  private lockedCredential(stored: StoredCredential): Credential {
    return {
      ...this.rowMeta(stored),
      integrityError: true,
      title: 'Integrity check failed',
      username: '',
      password: '',
      tags: [],
    };
  }

  /** v2 rows yield authenticated data only; plaintext columns are never read. */
  private async decryptBoundCredential(
    stored: StoredCredential,
    vaultKey: CryptoKey,
    userId: string
  ): Promise<Credential> {
    const meta = this.rowMeta(stored);
    try {
      const f = await openRow(stored, vaultKey, userId);
      return {
        ...meta,
        securityScore: stored.securityScore,
        title: f.encryptedTitle ?? '',
        username: f.encryptedUsername ?? '',
        password: f.encryptedPassword ?? '',
        url: f.encryptedUrl,
        notes: f.encryptedNotes,
        tags: f.encryptedTags ? (JSON.parse(f.encryptedTags) as string[]) : [],
        totpSecret: f.encryptedTotpSecret,
        cardNumber: f.encryptedCardNumber,
        cvv: f.encryptedCvv,
        cardholderName: f.encryptedCardholderName,
        expiryMonth: f.encryptedExpiryMonth,
        expiryYear: f.encryptedExpiryYear,
        cardType: f.encryptedCardType as Credential['cardType'],
        billingAddress: f.encryptedBillingAddress,
        backupCodes: f.encryptedBackupCodes
          ? (JSON.parse(f.encryptedBackupCodes) as Credential['backupCodes'])
          : undefined,
      };
    } catch {
      return this.lockedCredential(stored);
    }
  }

  // ── Decrypt a stored row into a domain Credential ─────────────────────────

  async decryptCredential(
    stored: StoredCredential,
    vaultKey: CryptoKey,
    userId: string = stored.userId ?? ''
  ): Promise<Credential> {
    if (isV2Row(stored)) return this.decryptBoundCredential(stored, vaultKey, userId);
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

      // Decrypt backup codes if present
      let backupCodes: import('@/domain/entities/Credential').BackupCode[] | undefined;
      if (stored.encryptedBackupCodes) {
        try {
          const encryptedCodes = JSON.parse(stored.encryptedBackupCodes);
          const codesJson = await decrypt(encryptedCodes, vaultKey);
          backupCodes = JSON.parse(codesJson) as import('@/domain/entities/Credential').BackupCode[];
        } catch (err) {
          console.error('Failed to decrypt backup codes:', err);
          backupCodes = [];
        }
      }

      return {
        id: stored.id, title, username, password, url, notes,
        category: stored.category, tags,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
        lastAccessedAt: stored.lastAccessedAt ? new Date(stored.lastAccessedAt) : undefined,
        isFavorite: stored.isFavorite,
        securityScore: stored.securityScore,
        totpSecret, cardNumber, cardholderName, expiryMonth, expiryYear,
        cvv, cardType, billingAddress, backupCodes,
      };
    } catch {
      // Falling back to plaintext columns here would let anyone who damages the
      // password blob choose the URL and notes the user sees.
      return this.lockedCredential(stored);
    }
  }

  // ── save() — backward-compat convenience (uses createWithId for new records)

  async save(credential: Credential, encryptionKey: CryptoKey, userId: string): Promise<Credential> {
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
          backupCodes: credential.backupCodes,
          cardNumber: credential.cardNumber,
          cardholderName: credential.cardholderName,
          expiryMonth: credential.expiryMonth,
          expiryYear: credential.expiryYear,
          cvv: credential.cvv,
          cardType: credential.cardType,
          billingAddress: credential.billingAddress,
        },
        encryptionKey,
        userId
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
        backupCodes: credential.backupCodes,
        cardNumber: credential.cardNumber,
        cardholderName: credential.cardholderName,
        expiryMonth: credential.expiryMonth,
        expiryYear: credential.expiryYear,
        cvv: credential.cvv,
        cardType: credential.cardType,
        billingAddress: credential.billingAddress,
      },
      encryptionKey,
      userId
    );
  }
}

export const credentialRepository = new CredentialRepository();
