/**
 * Metadata sealing — post-login migration pass.
 *
 * Dexie schema migrations cannot access the vault key, so v5 only changes
 * the index schema. This function runs after every successful login and
 * encrypts any pre-v5 credential records that still carry plaintext metadata
 * (isSealed !== true). It is safe to call repeatedly: already-sealed records
 * are skipped and calling it twice on an empty batch returns 0.
 *
 * See SECURITY_PWA_ENHANCEMENT_PLAN.md (S5).
 */

import { db, type StoredCredential } from '../storage/database';
import { encrypt, decrypt } from '@/core/crypto/encryption';

async function encryptField(value: string, key: CryptoKey): Promise<string> {
  return JSON.stringify(await encrypt(value, key));
}

/**
 * Ownership guard (Finding 1 follow-up): sealing a row with the wrong user's
 * vault key would corrupt it permanently for its rightful owner. Owned rows
 * must belong to the calling user; unowned legacy rows require cryptographic
 * proof — the caller's key must decrypt the row's encryptedPassword (same
 * AES-GCM auth-tag proof as CredentialRepositoryImpl.canClaim).
 */
async function ownsRecord(
  record: StoredCredential,
  vaultKey: CryptoKey,
  userId: string
): Promise<boolean> {
  if (record.userId !== undefined) return record.userId === userId;
  try {
    await decrypt(JSON.parse(record.encryptedPassword) as Parameters<typeof decrypt>[0], vaultKey);
    return true;
  } catch {
    return false;
  }
}

async function encryptOptional(value: string | undefined, key: CryptoKey): Promise<string | undefined> {
  if (!value) return undefined;
  return encryptField(value, key);
}

/**
 * Finds all credentials where `isSealed !== true`, encrypts their plaintext
 * metadata fields using `vaultKey`, clears the plaintext columns, and marks
 * the record as sealed.
 *
 * @returns the number of records that were sealed in this call.
 */
export async function sealLegacyMetadata(vaultKey: CryptoKey, userId: string): Promise<number> {
  const candidates = await db.credentials
    .filter((c) => c.isSealed !== true)
    .toArray();

  const unsealed: StoredCredential[] = [];
  for (const record of candidates) {
    if (await ownsRecord(record, vaultKey, userId)) {
      unsealed.push(record);
    }
  }

  if (unsealed.length === 0) return 0;

  await Promise.all(
    unsealed.map(async (record) => {
      // Sealing implies ownership proof, so claim unowned legacy rows here
      // (mirrors the repository's lazy-claim behaviour).
      const updates: Partial<StoredCredential> = { isSealed: true, userId };

      // Encrypt metadata fields that are still plaintext
      if (record.title) {
        updates.encryptedTitle = await encryptField(record.title, vaultKey);
        updates.title = undefined;
      }
      if (record.username) {
        updates.encryptedUsername = await encryptField(record.username, vaultKey);
        updates.username = undefined;
      }
      if (record.url) {
        updates.encryptedUrl = await encryptField(record.url, vaultKey);
        updates.url = undefined;
      }
      if (record.tags && record.tags.length > 0) {
        updates.encryptedTags = await encryptField(JSON.stringify(record.tags), vaultKey);
        updates.tags = [];
      }

      // Card metadata
      if (record.cardholderName) {
        updates.encryptedCardholderName = await encryptField(record.cardholderName, vaultKey);
        updates.cardholderName = undefined;
      }
      if (record.expiryMonth) {
        updates.encryptedExpiryMonth = await encryptField(record.expiryMonth, vaultKey);
        updates.expiryMonth = undefined;
      }
      if (record.expiryYear) {
        updates.encryptedExpiryYear = await encryptField(record.expiryYear, vaultKey);
        updates.expiryYear = undefined;
      }
      if (record.cardType) {
        updates.encryptedCardType = await encryptField(record.cardType, vaultKey);
        updates.cardType = undefined;
      }
      if (record.billingAddress) {
        updates.encryptedBillingAddress = await encryptField(record.billingAddress, vaultKey);
        updates.billingAddress = undefined;
      }

      // Legacy plaintext notes: always clear the plaintext column; only
      // encrypt to encryptedNotes when there isn't already an encrypted value
      // present (fixes 3324556176 — plaintext was kept when encryptedNotes existed).
      if (record.notes) {
        if (!record.encryptedNotes) {
          updates.encryptedNotes = await encryptOptional(record.notes, vaultKey);
        }
        updates.notes = undefined; // always clear the plaintext column
      }

      await db.credentials.update(record.id, updates);
    })
  );

  return unsealed.length;
}
