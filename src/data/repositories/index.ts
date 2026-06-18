// Public API — Safe for external use
export { UserRepositoryImpl } from './UserRepositoryImpl';
export { CredentialRepositoryImpl } from './CredentialRepositoryImpl';
export { ProfileRepositoryImpl } from './ProfileRepositoryImpl';
export { breachResultsRepository } from './breachResultsRepository';
export { validateImportPayload, parseImportPayload } from './importValidation';
export { sealLegacyMetadata, MetadataSealing } from './metadataSealing';
export { migrateProfilesToV10 } from './profileMigration';

// Types
export type {
  IUserRepository,
  ICredentialRepository,
  IProfileRepository,
  ImportedCredential,
  StoredBreachResult,
} from '../../../domain/repositories';
