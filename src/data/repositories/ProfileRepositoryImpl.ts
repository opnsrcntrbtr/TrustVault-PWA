/**
 * Vault profile repository (Phase 7 — multi-vault profiles). Mirrors
 * CredentialRepositoryImpl's encrypt/decrypt + per-user scoping pattern.
 * Unlike credentials, profiles have no legacy-unowned-row case — every row
 * always carries userId — so ownership checks are a plain equality, no
 * decryption-proof claiming needed.
 */
import { db, type StoredVaultProfile } from '@/data/storage/database';
import { encrypt, decrypt } from '@/core/crypto/encryption';
import type { IProfileRepository } from '@/domain/repositories/IProfileRepository';
import type { VaultProfile, VaultProfileInput } from '@/domain/entities/VaultProfile';

class ProfileRepository implements IProfileRepository {
  private async toDomain(stored: StoredVaultProfile, key: CryptoKey): Promise<VaultProfile> {
    const name = await decrypt(
      JSON.parse(stored.encryptedName) as Parameters<typeof decrypt>[0],
      key
    );
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

  private async getOwnedRow(id: string, userId: string): Promise<StoredVaultProfile> {
    const row = await db.vaultProfiles.get(id);
    if (!row || row.userId !== userId) {
      // Identical message for "missing" vs "not yours" — no existence oracle.
      throw new Error('Profile not found');
    }
    return row;
  }

  async create(
    input: VaultProfileInput,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<VaultProfile> {
    const now = Date.now();
    if (input.isDefault) {
      await db.vaultProfiles
        .where('userId')
        .equals(userId)
        .filter((p) => p.isDefault)
        .modify({ isDefault: false });
    }

    const row: StoredVaultProfile = {
      id: crypto.randomUUID(),
      userId,
      encryptedName: JSON.stringify(await encrypt(input.name, encryptionKey)),
      type: input.type,
      accentColor: input.accentColor,
      icon: input.icon,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await db.vaultProfiles.add(row);
    return this.toDomain(row, encryptionKey);
  }

  async findById(id: string, decryptionKey: CryptoKey, userId: string): Promise<VaultProfile | null> {
    const row = await db.vaultProfiles.get(id);
    if (!row || row.userId !== userId) return null;
    return this.toDomain(row, decryptionKey);
  }

  async findAll(decryptionKey: CryptoKey, userId: string): Promise<VaultProfile[]> {
    const rows = await db.vaultProfiles.where('userId').equals(userId).toArray();
    return Promise.all(rows.map((row) => this.toDomain(row, decryptionKey)));
  }

  async update(
    id: string,
    input: Partial<VaultProfileInput>,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<VaultProfile> {
    const row = await this.getOwnedRow(id, userId);

    if (input.isDefault) {
      await db.vaultProfiles
        .where('userId')
        .equals(userId)
        .filter((p) => p.isDefault && p.id !== id)
        .modify({ isDefault: false });
    }

    const updates: Partial<StoredVaultProfile> = { updatedAt: Date.now() };
    if (input.name !== undefined) {
      updates.encryptedName = JSON.stringify(await encrypt(input.name, encryptionKey));
    }
    if (input.type !== undefined) updates.type = input.type;
    if (input.accentColor !== undefined) updates.accentColor = input.accentColor;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

    await db.vaultProfiles.update(id, updates);
    const updated = await db.vaultProfiles.get(id);
    return this.toDomain(updated ?? { ...row, ...updates }, encryptionKey);
  }

  async delete(id: string, vaultKey: CryptoKey, userId: string): Promise<void> {
    const row = await this.getOwnedRow(id, userId);

    await db.credentials.where('profileId').equals(id).delete();
    await db.vaultProfiles.delete(id);

    const remaining = await db.vaultProfiles.where('userId').equals(userId).toArray();
    if (remaining.length === 0) {
      await this.create({ name: 'Personal', type: 'personal', isDefault: true }, vaultKey, userId);
    } else if (row.isDefault && !remaining.some((p) => p.isDefault)) {
      const next = remaining[0];
      if (next) {
        await db.vaultProfiles.update(next.id, { isDefault: true });
      }
    }
  }

  async getDefault(decryptionKey: CryptoKey, userId: string): Promise<VaultProfile | null> {
    const row = await db.vaultProfiles
      .where('userId')
      .equals(userId)
      .filter((p) => p.isDefault)
      .first();
    if (!row) return null;
    return this.toDomain(row, decryptionKey);
  }

  async setDefault(id: string, userId: string): Promise<void> {
    await this.getOwnedRow(id, userId);
    await db.vaultProfiles
      .where('userId')
      .equals(userId)
      .filter((p) => p.isDefault && p.id !== id)
      .modify({ isDefault: false });
    await db.vaultProfiles.update(id, { isDefault: true });
  }
}

export const profileRepository = new ProfileRepository();
