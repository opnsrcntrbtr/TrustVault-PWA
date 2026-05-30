/**
 * Username validation & normalization (PII-privacy identity model).
 *
 * TrustVault is moving from email-as-identity to a username-as-identity model so
 * that account creation never requires PII. These helpers are the single source
 * of truth for what a valid username is. They are pure and dependency-free so
 * both the UI (signup/signin validation) and the DB v7 migration
 * (`usernameMigration.ts`) can share them.
 */

/** Allowed username shape: 3–32 chars of letters, digits, dot, underscore, hyphen. */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/**
 * Names that must not be claimable, to avoid impersonation/confusion on a device
 * that may hold several accounts. Compared case-insensitively.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'root',
  'superuser',
  'sysadmin',
  'system',
  'trustvault',
  'support',
  'security',
  'null',
  'undefined',
]);

/**
 * Canonical display form: NFKC-folded (defeats Unicode look-alike duplicates)
 * and trimmed. Case is preserved for display; uniqueness is compared on the
 * lowercased form via {@link usernameKey}.
 */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim();
}

/** Case-insensitive uniqueness key. Always store/compare usernames via this. */
export function usernameKey(raw: string): string {
  return normalizeUsername(raw).toLowerCase();
}

export interface UsernameValidationResult {
  valid: boolean;
  /** Human-readable reason when `valid` is false. */
  error?: string;
}

/**
 * Validates a user-chosen username. Returns a discriminated result rather than
 * throwing so the UI can render the message inline.
 */
export function validateUsername(raw: string): UsernameValidationResult {
  const normalized = normalizeUsername(raw);

  if (normalized.length === 0) {
    return { valid: false, error: 'Username is required.' };
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${String(USERNAME_MIN_LENGTH)} characters.` };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: `Username must be at most ${String(USERNAME_MAX_LENGTH)} characters.` };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { valid: false, error: 'Use only letters, numbers, dot, underscore, or hyphen.' };
  }
  if (RESERVED_USERNAMES.has(normalized.toLowerCase())) {
    return { valid: false, error: 'That username is reserved. Please choose another.' };
  }
  return { valid: true };
}
