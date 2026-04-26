import {
  type Credential,
  type CredentialInput,
  type CredentialSecret,
  type CredentialSummary,
  toCredentialSummary,
} from '@/domain/entities/Credential';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';

export async function listCredentialSummaries(): Promise<CredentialSummary[]> {
  return credentialRepository.findAllSummaries();
}

export async function getCredentialSummary(id: string): Promise<CredentialSummary | null> {
  return credentialRepository.findSummaryById(id);
}

export async function getCredentialForEdit(
  id: string,
  vaultKey: CryptoKey
): Promise<Credential | null> {
  return credentialRepository.findById(id, vaultKey);
}

export async function revealCredentialSecret(
  id: string,
  vaultKey: CryptoKey
): Promise<CredentialSecret | null> {
  return credentialRepository.findSecretById(id, vaultKey);
}

export async function createCredential(
  input: CredentialInput,
  vaultKey: CryptoKey
): Promise<CredentialSummary> {
  const credential = await credentialRepository.create(input, vaultKey);
  return toCredentialSummary(credential);
}

export async function updateCredential(
  id: string,
  input: Partial<CredentialInput>,
  vaultKey: CryptoKey
): Promise<CredentialSummary> {
  const credential = await credentialRepository.update(id, input, vaultKey);
  return toCredentialSummary(credential);
}

export async function deleteCredential(id: string): Promise<void> {
  await credentialRepository.delete(id);
}

export async function updateCredentialAccessTime(id: string): Promise<void> {
  await credentialRepository.updateAccessTime(id);
}

export async function toggleCredentialFavorite(
  id: string,
  isFavorite: boolean,
  vaultKey: CryptoKey
): Promise<CredentialSummary> {
  return updateCredential(id, { isFavorite }, vaultKey);
}

export async function listDecryptedCredentials(vaultKey: CryptoKey): Promise<Credential[]> {
  return credentialRepository.findAll(vaultKey);
}

export async function analyzeCredentialSecurityScore(
  id: string,
  vaultKey: CryptoKey
): Promise<number> {
  return credentialRepository.analyzeSecurityScore(id, vaultKey);
}
