// Public API — Safe for external use
export {
  encrypt,
  decrypt,
  deriveKeyFromPassword,
  encryptWithPassword,
  decryptWithPassword,
} from './encryption';

export {
  hashPassword,
  verifyPassword,
  generateSecurePassword,
} from './password';

export {
  encryptExport,
  decryptImport,
} from './exportEncryption';

// Types — Safe for external use
export type {
  CryptoResult,
  CryptoError,
  EncryptionOptions,
  DecryptionOptions,
} from './types';
