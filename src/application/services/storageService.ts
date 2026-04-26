import { db, initializeDatabase as openDatabase } from '@/data/storage/database';

export async function initializeApplicationStorage(): Promise<void> {
  await openDatabase();
}

export async function clearAllLocalVaultData(): Promise<void> {
  await db.transaction('rw', [db.users, db.credentials, db.sessions, db.settings, db.breachResults], async () => {
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
    await db.settings.clear();
    await db.breachResults.clear();
  });
}
