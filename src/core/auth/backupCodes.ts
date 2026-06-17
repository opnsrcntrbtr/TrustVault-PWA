import type { BackupCode } from '@/domain/entities/Credential';

/**
 * Generates cryptographically secure random hex digit (0-15).
 * Uses rejection sampling to avoid modulo bias.
 */
function randomHexDigit(): string {
  const buf = new Uint8Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] ?? 0; // buf[0] is always defined, but satisfy TypeScript
  } while (value >= 240); // 240 = floor(256 / 16) * 16, reject to avoid bias
  return (value % 16).toString(16);
}

/**
 * Generates a UUID v4 in the browser using cryptographically secure randomness.
 * Used for backup code IDs.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = parseInt(randomHexDigit(), 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates cryptographically secure random decimal digit (0-9).
 * Uses rejection sampling to avoid modulo bias.
 * @param count Number of digits to generate
 * @returns String of random digits
 */
function randomDigits(count: number): string {
  const buf = new Uint32Array(1);
  let out = '';
  while (out.length < count) {
    crypto.getRandomValues(buf);
    // Rejection-sample to avoid modulo bias:
    // 0xFFFFFFFF = 4294967295
    // floor(4294967295 / 10) * 10 = 4294967290
    // Reject values >= 4294967290 to ensure uniform distribution mod 10
    const max = Math.floor(0xffffffff / 10) * 10;
    const value = buf[0] ?? 0; // buf[0] is always defined, but satisfy TypeScript
    if (value < max) {
      out += (value % 10).toString();
    }
  }
  return out;
}

/**
 * Generates a set of backup codes for TOTP recovery.
 * Each code is an 8-digit numeric string.
 * @param count Number of codes to generate (default: 12)
 * @returns Array of unique backup codes
 */
export function generateBackupCodes(count: number = 12): BackupCode[] {
  const codes: BackupCode[] = [];
  const used = new Set<string>();

  while (codes.length < count) {
    // Generate cryptographically secure random 8-digit number
    const code = randomDigits(8);

    // Ensure uniqueness
    if (!used.has(code)) {
      used.add(code);
      codes.push({
        id: generateUUID(),
        code,
        consumed: false,
      });
    }
  }

  return codes;
}

/**
 * Validates backup code format.
 * Accepts 8-digit numeric strings, with optional space: "12345678" or "1234 5678"
 * @param code Code to validate
 * @returns true if valid format, false otherwise
 */
export function validateBackupCode(code: string): boolean {
  // Strip spaces
  const cleaned = code.replace(/\s/g, '');

  // Check exactly 8 digits
  return /^\d{8}$/.test(cleaned);
}

/**
 * Normalizes backup code format by removing spaces.
 * "1234 5678" → "12345678"
 * @param code Code to normalize
 * @returns Normalized code (spaces removed)
 */
export function normalizeBackupCode(code: string): string {
  return code.replace(/\s/g, '');
}

/**
 * Consumes a backup code (marks it used) if it exists and hasn't been consumed.
 * Returns a NEW array (does not mutate input).
 * @param codes Array of backup codes
 * @param code 8-digit code to consume
 * @returns New array with code marked consumed, or null if not found/already consumed
 */
export function consumeBackupCode(
  codes: BackupCode[],
  code: string
): BackupCode[] | null {
  const normalized = normalizeBackupCode(code);

  // Find the code
  const index = codes.findIndex((c) => c.code === normalized);
  if (index === -1) {
    return null; // Code not found
  }

  const targetCode = codes[index];
  if (targetCode === undefined || targetCode.consumed) {
    return null; // Code already consumed
  }

  // Return new array with code marked consumed
  const updated = [...codes];
  updated[index] = {
    ...targetCode,
    consumed: true,
    lastUsedAt: Date.now(),
  };

  return updated;
}
