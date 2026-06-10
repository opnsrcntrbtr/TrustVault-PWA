/**
 * HIBP Prefix Store (P4 — background breach re-checks)
 *
 * Persists each credential's 5-char SHA-1 prefix so the service worker can
 * prefetch HIBP range responses while the vault is locked. The prefix is
 * exactly the string already sent to api.pwnedpasswords.com under k-anonymity
 * (~1M passwords share each prefix), so storing it outside the vault adds no
 * new disclosure. Documented as a residual in SECURITY.md.
 *
 * All writers swallow storage errors: prefix bookkeeping must never break
 * credential CRUD (offline-first, graceful DB failure per project rules).
 */

import { sha1 } from '@noble/hashes/legacy';
import { bytesToHex } from '@noble/hashes/utils';
import { db, type StoredBreachPrefix } from '@/data/storage/database';

export const SHA1_PREFIX_LENGTH = 5;

/**
 * Computes the uppercase 5-hex-char SHA-1 prefix used by the HIBP range API.
 */
export function computeSha1Prefix(password: string): string {
  const hashBytes = sha1(new TextEncoder().encode(password));
  return bytesToHex(hashBytes).toUpperCase().substring(0, SHA1_PREFIX_LENGTH);
}

/**
 * Upserts the prefix row for a credential. Called whenever a credential's
 * password is created or changed.
 */
export async function saveBreachPrefix(credentialId: string, password: string): Promise<void> {
  try {
    const row: StoredBreachPrefix = {
      credentialId,
      sha1Prefix: computeSha1Prefix(password),
      updatedAt: Date.now(),
    };
    await db.breachPrefixes.put(row);
  } catch (error) {
    console.warn('Failed to persist breach prefix:', error);
  }
}

/**
 * Removes the prefix row when its credential is deleted.
 */
export async function deleteBreachPrefix(credentialId: string): Promise<void> {
  try {
    await db.breachPrefixes.delete(credentialId);
  } catch (error) {
    console.warn('Failed to delete breach prefix:', error);
  }
}

/**
 * Returns all stored prefixes (used by the on-unlock refresh and exposed to
 * the periodic-sync service worker via raw IndexedDB reads).
 */
export async function getAllBreachPrefixes(): Promise<StoredBreachPrefix[]> {
  try {
    return await db.breachPrefixes.toArray();
  } catch (error) {
    console.warn('Failed to read breach prefixes:', error);
    return [];
  }
}
