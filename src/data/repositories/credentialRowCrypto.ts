/**
 * Row rules for AAD-bound credential storage.
 *
 * Each row is its own anchor: if `encryptedPassword` is v2, the whole row is
 * v2. Every encrypted column must then authenticate under its own column name
 * and the plaintext columns are never trusted. This module does no Dexie I/O.
 */
import { encrypt, decrypt, type EncryptedData } from '@/core/crypto/encryption';
import { buildAad, CREDENTIAL_FIELDS, type CredentialField } from '@/core/crypto/aad';
import type { StoredCredential } from '@/data/storage/database';

export class IntegrityError extends Error {
  constructor() {
    super('Integrity check failed');
    this.name = 'IntegrityError';
  }
}

export type RowPlaintext = Partial<Record<CredentialField, string>>;

/** Legacy plaintext column behind each encrypted column that ever had one. */
const PLAINTEXT_SOURCE = {
  encryptedTitle: 'title',
  encryptedUsername: 'username',
  encryptedUrl: 'url',
  encryptedNotes: 'notes',
  encryptedCardholderName: 'cardholderName',
  encryptedExpiryMonth: 'expiryMonth',
  encryptedExpiryYear: 'expiryYear',
  encryptedCardType: 'cardType',
  encryptedBillingAddress: 'billingAddress',
} as const;

export function isV2Row(row: Pick<StoredCredential, 'encryptedPassword'>): boolean {
  try {
    return (JSON.parse(row.encryptedPassword) as EncryptedData | null)?.v === 2;
  } catch {
    return false;
  }
}

const fieldAad = (userId: string, recordId: string, field: CredentialField) =>
  buildAad({ purpose: 'credential-field', userId, recordId, field });

export async function sealField(
  value: string,
  key: CryptoKey,
  userId: string,
  recordId: string,
  field: CredentialField
): Promise<string> {
  return JSON.stringify(await encrypt(value, key, fieldAad(userId, recordId, field)));
}

export async function openRow(
  row: StoredCredential,
  key: CryptoKey,
  userId: string
): Promise<RowPlaintext> {
  try {
    const entries = await Promise.all(
      CREDENTIAL_FIELDS.filter(
        (field) => field === 'encryptedPassword' || row[field] !== undefined
      ).map(async (field) => {
        const data = JSON.parse(row[field] as string) as EncryptedData;
        if (data.v !== 2) throw new IntegrityError();
        return [field, await decrypt(data, key, fieldAad(userId, row.id, field))] as const;
      })
    );
    return Object.fromEntries(entries);
  } catch {
    throw new IntegrityError();
  }
}

export async function resealRow(
  row: StoredCredential,
  key: CryptoKey,
  userId: string
): Promise<Partial<StoredCredential>> {
  try {
    const plain: RowPlaintext = {};
    for (const field of CREDENTIAL_FIELDS) {
      const blob = row[field];
      if (blob !== undefined) {
        plain[field] = await decrypt(JSON.parse(blob) as EncryptedData, key);
      }
    }
    // A value that only exists in a plaintext column is what the legacy read
    // shows, so it must survive the upgrade.
    for (const [field, source] of Object.entries(PLAINTEXT_SOURCE)) {
      const value = row[source];
      if (plain[field as CredentialField] === undefined && value) {
        plain[field as CredentialField] = value;
      }
    }
    if (plain.encryptedTags === undefined && row.tags && row.tags.length > 0) {
      plain.encryptedTags = JSON.stringify(row.tags);
    }

    const updates: Partial<StoredCredential> = { userId, isSealed: true, tags: [] };
    for (const source of Object.values(PLAINTEXT_SOURCE)) updates[source] = undefined;
    for (const [field, value] of Object.entries(plain)) {
      updates[field as CredentialField] = await sealField(value, key, userId, row.id, field as CredentialField);
    }

    // Verify before anyone commits it.
    const reopened = await openRow({ ...row, ...updates }, key, userId);
    if (Object.entries(plain).some(([f, v]) => reopened[f as CredentialField] !== v)) {
      throw new IntegrityError();
    }
    return updates;
  } catch {
    throw new IntegrityError();
  }
}
