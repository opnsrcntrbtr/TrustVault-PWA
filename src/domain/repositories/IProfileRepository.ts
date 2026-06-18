/**
 * Domain Repository Interface: ProfileRepository
 * Defines contract for vault profile storage operations (Phase 7 —
 * multi-vault profiles). Every row-touching operation takes the
 * authenticated user's id, mirroring ICredentialRepository's per-user
 * partitioning convention — profiles always have an owning userId (no
 * legacy-unowned-row case exists for this table, unlike credentials pre-v9).
 */
import { VaultProfile, VaultProfileInput } from '../entities/VaultProfile';

export interface IProfileRepository {
  create(input: VaultProfileInput, encryptionKey: CryptoKey, userId: string): Promise<VaultProfile>;
  findById(id: string, decryptionKey: CryptoKey, userId: string): Promise<VaultProfile | null>;
  findAll(decryptionKey: CryptoKey, userId: string): Promise<VaultProfile[]>;
  update(
    id: string,
    input: Partial<VaultProfileInput>,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<VaultProfile>;

  /**
   * Deletes the profile and all credentials it owns. If the deleted profile
   * was the default (or the last remaining profile), a new default profile
   * is selected (or created, "Personal", if none remain) — vaultKey is
   * needed to encrypt that recreated profile's name.
   */
  delete(id: string, vaultKey: CryptoKey, userId: string): Promise<void>;

  getDefault(decryptionKey: CryptoKey, userId: string): Promise<VaultProfile | null>;
  setDefault(id: string, userId: string): Promise<void>;
}
