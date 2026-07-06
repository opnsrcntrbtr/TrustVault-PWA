/**
 * Maps webauthn-prf-zktv typed errors (stable `.code` values) to TrustVault's
 * existing user-facing copy. Keeps UI strings centralized and guarantees no
 * cause chains or key material from the crypto layer reach the UI or logs.
 */
import { ZktvError } from 'webauthn-prf-zktv';

const GENERIC_MESSAGE =
  'Biometric authentication failed. Please try again or use your master password.';

export function mapZktvError(error: unknown): Error {
  if (error instanceof ZktvError) {
    switch (error.code) {
      case 'PRF_UNSUPPORTED':
        return new Error(
          'This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.',
        );
      case 'CEREMONY_CANCELLED':
        return new Error(
          'Biometric authentication was cancelled or timed out. Please try again or use your master password.',
        );
      case 'PRF_RESULT_MISSING':
        return new Error(
          'Authenticator did not return a PRF result. This device does not support PRF; please use your master password.',
        );
      case 'REPLAY':
        return new Error('Biometric authentication failed a security check. Please try again.');
      case 'DECRYPT_FAILED':
      case 'RECORD_FORMAT':
        return new Error(
          'Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.',
        );
      default:
        return new Error(GENERIC_MESSAGE);
    }
  }
  return error instanceof Error ? error : new Error(GENERIC_MESSAGE);
}
