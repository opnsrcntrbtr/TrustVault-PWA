/**
 * Username backfill migration (DB v7).
 *
 * Pre-v7 accounts are keyed by `email`. v7 introduces a required, unique
 * username as the identity key and makes email optional. This module derives a
 * unique username for every existing account from its email local-part, exactly
 * the way the v6 biometric migration keeps its logic in a pure, unit-testable
 * function (`biometricMigration.stripLegacyBiometric`) that the Dexie upgrade
 * hook calls.
 *
 * Collision resolution needs to see ALL accounts at once (a per-record
 * `Table.modify` callback cannot), so this operates on the full batch and
 * returns an id → {username, usernameLower} assignment map.
 *
 * Determinism guarantees (critical: a unique index `&usernameLower` is applied
 * in the same upgrade, so a non-unique result would abort the DB open):
 *   - Accounts are processed oldest-first (createdAt asc, id asc tie-break), so
 *     the earliest account keeps the unsuffixed name across re-runs.
 *   - Suffixes are appended as base, base2, base3, … (truncated to fit 32 chars).
 *   - Already-assigned usernames are preserved (idempotent / re-run safe).
 */

import {
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
} from './usernameValidation';

/** Minimal shape this migration needs from a stored user row. */
export interface MigratableUser {
  id: string;
  email?: string | undefined;
  createdAt: number;
  /** Present only if a prior run already assigned one (idempotency). */
  username?: string | undefined;
  usernameLower?: string | undefined;
}

export interface UsernameAssignment {
  username: string;
  usernameLower: string;
}

/** Fallback stem when an email yields nothing usable. */
const FALLBACK_STEM = 'user';

/**
 * Produces a valid, lowercase username stem from an arbitrary email local-part.
 * Guarantees the result matches USERNAME_REGEX and is not reserved (reserved or
 * too-short stems are prefixed with `user_`). Always lowercase: derived
 * usernames have no meaningful case, and lowercasing keeps display === key.
 */
export function deriveUsernameStem(email?: string): string {
  const localPart = (email ?? '').split('@')[0] ?? '';

  // Keep only allowed characters; NFKC first to fold look-alikes.
  let stem = localPart
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

  if (stem.length > USERNAME_MAX_LENGTH) {
    stem = stem.slice(0, USERNAME_MAX_LENGTH);
  }

  if (stem.length === 0) {
    // No usable characters at all → bare fallback stem (e.g. '@x.com', '!!!@x').
    stem = FALLBACK_STEM;
  } else if (stem.length < USERNAME_MIN_LENGTH || RESERVED_USERNAMES.has(stem)) {
    // Too short or reserved → namespace under the fallback stem.
    stem = `${FALLBACK_STEM}_${stem}`.slice(0, USERNAME_MAX_LENGTH);
  }

  // Final guard: anything still invalid (e.g. empty) collapses to the stem.
  if (!USERNAME_REGEX.test(stem)) {
    stem = FALLBACK_STEM;
  }

  return stem;
}

/**
 * Returns a lowercase username unique against `taken`, appending the smallest
 * numeric suffix (>= 2) needed and truncating the base so the result never
 * exceeds USERNAME_MAX_LENGTH.
 */
function makeUnique(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = String(i);
    const trimmed = base.slice(0, USERNAME_MAX_LENGTH - suffix.length);
    const candidate = `${trimmed}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Computes a unique username assignment for every user. Pure: does not mutate
 * the input. The returned map is keyed by user id.
 */
export function deriveUniqueUsernames(
  users: readonly MigratableUser[],
): Map<string, UsernameAssignment> {
  const taken = new Set<string>();
  const result = new Map<string, UsernameAssignment>();

  // Oldest-first, id as a stable tie-break → deterministic suffix ordering.
  const ordered = [...users].sort(
    (a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  for (const user of ordered) {
    // Idempotency: honour a valid username already assigned by a prior run.
    const existing = user.usernameLower ?? user.username;
    let key: string;
    if (existing && USERNAME_REGEX.test(existing) && !taken.has(existing.toLowerCase())) {
      key = existing.toLowerCase();
    } else {
      key = makeUnique(deriveUsernameStem(user.email), taken);
    }
    taken.add(key);
    result.set(user.id, { username: key, usernameLower: key });
  }

  return result;
}
