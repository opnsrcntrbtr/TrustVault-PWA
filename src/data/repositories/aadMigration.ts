/**
 * Post-unlock upgrade of legacy ciphertexts to AAD-bound v2.
 *
 * Runs after sealLegacyMetadata() on password and biometric unlock. Idempotent.
 * A row is rewritten only if every column decrypts and verifies, and only if it
 * has not changed since it was read. updatedAt is preserved because the
 * "old password" audit depends on it.
 */
import { db } from '../storage/database';
import { encrypt, decrypt, type EncryptedData } from '@/core/crypto/encryption';
import { buildAad } from '@/core/crypto/aad';
import { isV2Row, resealRow } from './credentialRowCrypto';
import { commitRowIfUnchanged } from './rowCommit';

export interface UpgradeResult {
  upgraded: number;
  skipped: number;
}

async function upgradeCredentials(vaultKey: CryptoKey, userId: string, result: UpgradeResult): Promise<void> {
  const candidates = await db.credentials
    .filter(
      (c) =>
        (c.userId === userId || c.userId === undefined) && c.isSealed === true && !isV2Row(c)
    )
    .toArray();

  for (const row of candidates) {
    let updates: Awaited<ReturnType<typeof resealRow>>;
    try {
      updates = await resealRow(row, vaultKey, userId);
    } catch {
      // An unowned row this key cannot open is simply someone else's.
      if (row.userId === userId) result.skipped++;
      continue;
    }
    if (await commitRowIfUnchanged(row, updates)) result.upgraded++;
    else result.skipped++;
  }
}

async function upgradeProfileNames(vaultKey: CryptoKey, userId: string, result: UpgradeResult): Promise<void> {
  const rows = await db.vaultProfiles.where('userId').equals(userId).toArray();

  for (const row of rows) {
    let encryptedName: string;
    try {
      const data = JSON.parse(row.encryptedName) as EncryptedData;
      if (data.v === 2) continue;
      const aad = buildAad({ purpose: 'profile-name', userId, recordId: row.id });
      const name = await decrypt(data, vaultKey);
      const sealed = await encrypt(name, vaultKey, aad);
      if ((await decrypt(sealed, vaultKey, aad)) !== name) throw new Error('Verification failed');
      encryptedName = JSON.stringify(sealed);
    } catch {
      result.skipped++;
      continue;
    }
    await db.transaction('rw', db.vaultProfiles, async () => {
      const current = await db.vaultProfiles.get(row.id);
      if (current?.encryptedName !== row.encryptedName) {
        result.skipped++;
        return;
      }
      await db.vaultProfiles.update(row.id, { encryptedName });
      result.upgraded++;
    });
  }
}

export async function resealToAadV2(vaultKey: CryptoKey, userId: string): Promise<UpgradeResult> {
  const result: UpgradeResult = { upgraded: 0, skipped: 0 };
  await upgradeCredentials(vaultKey, userId, result);
  await upgradeProfileNames(vaultKey, userId, result);
  return result;
}
