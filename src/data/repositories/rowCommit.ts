import { db, type StoredCredential } from '../storage/database';

/**
 * Writes a whole-row upgrade only if the row is still the one it was built
 * from, so an edit made meanwhile is never overwritten. The WebCrypto work must
 * already be done: a Dexie transaction cannot await it.
 */
export async function commitRowIfUnchanged(
  snapshot: StoredCredential,
  updates: Partial<StoredCredential>
): Promise<boolean> {
  return db.transaction('rw', db.credentials, async () => {
    const current = await db.credentials.get(snapshot.id);
    if (
      current?.updatedAt !== snapshot.updatedAt ||
      current.encryptedPassword !== snapshot.encryptedPassword
    ) {
      return false;
    }
    await db.credentials.update(snapshot.id, updates);
    return true;
  });
}
