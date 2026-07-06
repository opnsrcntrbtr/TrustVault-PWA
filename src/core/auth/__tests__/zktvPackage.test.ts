import { describe, expect, it } from 'vitest';
import {
  generateSalt,
  parseRecord,
  serializeRecord,
  unwrapSecretBytes,
  wrapSecret,
  zeroize,
} from 'webauthn-prf-zktv';

describe('webauthn-prf-zktv package integration', () => {
  it('round-trips a prf-v1 wrap through serialize/parse', async () => {
    const prfOutput = generateSalt(32); // any 32 random bytes work as PRF output
    const prfSalt = generateSalt(32);
    const secret = new Uint8Array(32).fill(7);

    const record = await wrapSecret({ prfOutput, prfSalt, secret });
    expect(record.scheme).toBe('prf-v1');

    const reparsed = parseRecord(serializeRecord(record));
    const bytes = await unwrapSecretBytes({ record: reparsed, prfOutput });
    expect(Array.from(bytes)).toEqual(Array.from(secret));
    zeroize(bytes);
  });
});
