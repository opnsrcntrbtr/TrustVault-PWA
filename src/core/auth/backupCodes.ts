import type { BackupCode } from '@/domain/entities/Credential';

/**
 * Generates a UUID v4 in the browser.
 * Used for backup code IDs.
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
    // Generate random 8-digit number (0-99999999)
    const num = Math.floor(Math.random() * 100000000);
    const code = num.toString().padStart(8, '0');

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
