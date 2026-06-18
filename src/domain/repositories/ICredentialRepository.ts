/**
 * Domain Repository Interface: CredentialRepository
 * Defines contract for credential storage operations
 *
 * v9 (audit 2026-06-11, Finding 1): every row-touching operation takes the
 * authenticated user's id so credentials are partitioned per user. Legacy
 * (pre-v9) rows without an owner are lazily claimed when the caller's vault
 * key successfully decrypts them — AES-GCM auth failure proves non-ownership.
 */
import { Credential, CredentialInput } from '../entities/Credential';

export interface ICredentialRepository {
  // CRUD operations
  // profileId (Phase 7, optional): create() stamps the new row; read methods
  // filter to that profile when given, otherwise return all of the user's
  // credentials (pre-Phase-7 behavior) — backward compatible by default.
  create(
    input: CredentialInput,
    encryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential>;
  findById(id: string, decryptionKey: CryptoKey, userId: string): Promise<Credential | null>;
  findAll(decryptionKey: CryptoKey, userId: string, profileId?: string): Promise<Credential[]>;
  update(
    id: string,
    input: Partial<CredentialInput>,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<Credential>;
  delete(id: string, decryptionKey: CryptoKey, userId: string): Promise<void>;

  // Search and filter
  search(
    query: string,
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]>;
  findByCategory(
    category: string,
    decryptionKey: CryptoKey,
    userId: string,
    profileId?: string
  ): Promise<Credential[]>;
  findFavorites(decryptionKey: CryptoKey, userId: string, profileId?: string): Promise<Credential[]>;

  // Bulk operations
  exportAll(decryptionKey: CryptoKey, userId: string): Promise<string>; // Encrypted JSON export
  // mode 'merge' skips rows that match an existing credential's title+username
  // (case-insensitive), mirroring ImportDialog.tsx's UI-layer dedupe. Defaults
  // to 'append' (current behavior) for backward compatibility.
  importFromJson(
    data: string,
    encryptionKey: CryptoKey,
    userId: string,
    mode?: 'append' | 'merge'
  ): Promise<number>;

  // Security
  updateAccessTime(id: string, userId: string): Promise<void>;
  analyzeSecurityScore(id: string, decryptionKey: CryptoKey, userId: string): Promise<number>;
}
