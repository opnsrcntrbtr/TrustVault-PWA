import { describe, expect, it } from 'vitest';
import {
  CeremonyCancelledError,
  DecryptError,
  PrfResultMissingError,
  PrfUnsupportedError,
  RecordFormatError,
  ReplayError,
} from 'webauthn-prf-zktv';
import { mapZktvError } from '@/core/auth/zktvErrors';

describe('mapZktvError', () => {
  it('maps PRF_UNSUPPORTED to the master-password guidance', () => {
    expect(mapZktvError(new PrfUnsupportedError('x')).message).toBe(
      'This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.',
    );
  });

  it('maps CEREMONY_CANCELLED to the retry guidance', () => {
    expect(mapZktvError(new CeremonyCancelledError('x')).message).toBe(
      'Biometric authentication was cancelled or timed out. Please try again or use your master password.',
    );
  });

  it('maps PRF_RESULT_MISSING to the PRF-missing guidance', () => {
    expect(mapZktvError(new PrfResultMissingError('x')).message).toBe(
      'Authenticator did not return a PRF result. This device does not support PRF; please use your master password.',
    );
  });

  it('maps DECRYPT_FAILED and RECORD_FORMAT to re-enrollment guidance (generic — no wrong-key vs corrupt distinction)', () => {
    const expected =
      'Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.';
    expect(mapZktvError(new DecryptError('x')).message).toBe(expected);
    expect(mapZktvError(new RecordFormatError('x')).message).toBe(expected);
  });

  it('maps REPLAY to a security-check failure', () => {
    expect(mapZktvError(new ReplayError('x')).message).toBe(
      'Biometric authentication failed a security check. Please try again.',
    );
  });

  it('passes non-package errors through unchanged', () => {
    const original = new Error('User not found');
    expect(mapZktvError(original)).toBe(original);
  });

  it('wraps non-Error throwables in a generic message', () => {
    expect(mapZktvError('boom').message).toBe(
      'Biometric authentication failed. Please try again or use your master password.',
    );
  });
});
