/**
 * Domain Repository Interface: CredentialRepository
 * Defines contract for credential storage operations
 */
import { Credential, CredentialInput } from '../entities/Credential';

export interface ICredentialRepository {
  // CRUD operations
  create(input: CredentialInput, encryptionKey: CryptoKey): Promise<Credential>;
  findById(id: string, decryptionKey: CryptoKey): Promise<Credential | null>;
  findAll(decryptionKey: CryptoKey): Promise<Credential[]>;
  update(id: string, input: Partial<CredentialInput>, encryptionKey: CryptoKey): Promise<Credential>;
  delete(id: string): Promise<void>;
  
  // Search and filter
  search(query: string, decryptionKey: CryptoKey): Promise<Credential[]>;
  findByCategory(category: string, decryptionKey: CryptoKey): Promise<Credential[]>;
  findFavorites(decryptionKey: CryptoKey): Promise<Credential[]>;
  
  // Bulk operations
  exportAll(decryptionKey: CryptoKey): Promise<string>; // Encrypted JSON export
  importFromJson(data: string, encryptionKey: CryptoKey): Promise<number>;
  
  // Security
  updateAccessTime(id: string): Promise<void>;
  analyzeSecurityScore(id: string, decryptionKey: CryptoKey): Promise<number>;
}
