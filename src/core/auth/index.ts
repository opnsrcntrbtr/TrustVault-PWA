// Public API — Safe for external use
export {
  registerBiometric,
  authenticateBiometric,
  isWebAuthnSupported,
  isBiometricAvailable,
  detectPrfSupport,
  isPrfSupported,
  getDeviceName,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from './webauthn';

export {
  wrapVaultKeyWithPRF,
  unwrapVaultKeyWithPRF,
  deriveWrapKeyFromPRF,
  generatePrfSalt,
} from './biometricVaultKey';

export {
  generateTOTP,
  verifyTOTP,
  generateTOTPSecret,
  isValidTOTPSecret,
  getTOTPRemaining,
  getTOTPProgress,
  formatTOTPCode,
} from './totp';

export {
  generateBackupCodes,
  validateBackupCode,
  consumeBackupCode,
  normalizeBackupCode,
} from './backupCodes';

export {
  stripLegacyBiometric,
  isPrfCredential,
} from './biometricMigration';

export {
  deriveUniqueUsernames,
  deriveUsernameStem,
  makeUnique,
  normalizeUsername,
} from './usernameMigration';

export {
  isValidUsername,
  isReservedUsername,
  validateUsername,
} from './usernameValidation';

export { createRateLimiter } from './rateLimiter';

// Types — Safe for external use
export type {
  WebAuthnCredential,
  BiometricCredential,
  AuthSession,
  BackupCode,
  BackupCodeInputProps,
  MigratableUser,
  UsernameAssignment,
  RateLimiter,
  RateLimitState,
} from './types';

// Internal utilities — NOT exported
// These are only for use within the auth module:
// - computeHash() — use from crypto/ instead
// - base32Encode/Decode() — use from utils/ instead
// - stripResult() — internal type
// - ... others
