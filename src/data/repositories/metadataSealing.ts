/**
 * Metadata sealing — post-login migration pass.
 *
 * Dexie schema migrations cannot access the vault key, so v5 only changes
 * the index schema. This function runs after every successful login and
 * encrypts any pre-v5 credential records that still carry plaintext metadata
 * (isSealed !== true). It is safe to call repeatedly: already-sealed records
 * are skipped and calling it twice on an empty batch returns 0.
 *
 * Sealing writes AAD-bound v2 rows directly, so nothing creates new unbound
 * ciphertexts under the vault key.
 *
 * See SECURITY_PWA_ENHANCEMENT_PLAN.md (S5).
 */

import { db } from '../storage/database';
import { isV2Row, resealRow } from './credentialRowCrypto';
import { commitRowIfUnchanged } from './rowCommit';

/**
 * Seals every unsealed row the caller owns or may claim.
 *
 * Every row, whatever its userId says, must prove ownership: the key has to
 * decrypt its password blob and every other encrypted column. userId is
 * attacker-writable, so trusting it would encrypt planted plaintext under the
 * victim's key. A row that cannot be proven or fully read is left untouched.
 *
 * A v2 row is never sealed: its plaintext columns are untrusted.
 *
 * @returns the number of records that were sealed in this call.
 */
export async function sealLegacyMetadata(vaultKey: CryptoKey, userId: string): Promise<number> {
  const candidates = await db.credentials
    .filter(
      (c) =>
        c.isSealed !== true && (c.userId === userId || c.userId === undefined) && !isV2Row(c)
    )
    .toArray();

  let sealed = 0;
  for (const row of candidates) {
    let updates: Awaited<ReturnType<typeof resealRow>>;
    try {
      updates = await resealRow(row, vaultKey, userId);
    } catch {
      continue;
    }
    if (await commitRowIfUnchanged(row, updates)) sealed++;
  }
  return sealed;
}
