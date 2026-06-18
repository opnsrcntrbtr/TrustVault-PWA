/**
 * v10 post-login migration — multi-vault profiles (Phase 7).
 *
 * Dexie schema migrations cannot access the vault key, so the v10 .upgrade()
 * only adds the `vaultProfiles` table and `profileId` index (see
 * database.ts). This function runs after every successful login (mirrors
 * sealLegacyMetadata()) and creates the user's default "Personal" profile if
 * none exists, then backfills `profileId` on that user's credentials that
 * still lack one. Safe to call repeatedly: a user with an existing profile
 * is left untouched.
 */
import { db, type StoredVaultProfile } from '../storage/database';
import { encrypt, decrypt } from '@/core/crypto/encryption';
import type { VaultProfile } from '@/domain/entities/VaultProfile';

function toDomain(stored: StoredVaultProfile, name: string): VaultProfile {
  return {
    id: stored.id,
    name,
    type: stored.type,
    accentColor: stored.accentColor,
    icon: stored.icon,
    isDefault: stored.isDefault,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    lastUsedAt: stored.lastUsedAt ? new Date(stored.lastUsedAt) : undefined,
  };
}

export async function ensureDefaultProfile(
  vaultKey: CryptoKey,
  userId: string
): Promise<VaultProfile> {
  const existingDefault = await db.vaultProfiles
    .where('userId')
    .equals(userId)
    .filter((p) => p.isDefault)
    .first();

  let defaultRow: StoredVaultProfile;
  if (existingDefault) {
    defaultRow = existingDefault;
  } else {
    const now = Date.now();
    defaultRow = {
      id: crypto.randomUUID(),
      userId,
      encryptedName: JSON.stringify(await encrypt('Personal', vaultKey)),
      type: 'personal',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.vaultProfiles.add(defaultRow);
  }

  await db.credentials
    .where('userId')
    .equals(userId)
    .filter((c) => c.profileId === undefined)
    .modify({ profileId: defaultRow.id });

  const name = await decrypt(
    JSON.parse(defaultRow.encryptedName) as Parameters<typeof decrypt>[0],
    vaultKey
  );
  return toDomain(defaultRow, name);
}
