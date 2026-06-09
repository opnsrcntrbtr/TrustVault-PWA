/**
 * Vault import validation (S8 — SECURITY_HARDENING_PLAN_2026-06.md Phase E).
 *
 * Every vault import (plain JSON or decrypted .tvault payload) is validated
 * against this Zod schema BEFORE any row touches the repository. Malformed,
 * oversized, or wrong-shaped input is rejected with a user-friendly error
 * instead of being silently coerced into credentials.
 */
import { z } from 'zod';

/** Hard ceilings — generous for real vaults, hostile to abuse. */
export const IMPORT_LIMITS = {
  maxEntries: 10_000,
  maxFieldLength: 4_096,
  maxNotesLength: 50_000,
  maxTags: 50,
} as const;

const boundedString = (max: number = IMPORT_LIMITS.maxFieldLength) =>
  z.string().max(max);

const credentialCategorySchema = z.enum([
  'login',
  'credit_card',
  'bank_account',
  'secure_note',
  'identity',
  'api_key',
  'ssh_key',
]);

const cardTypeSchema = z.enum(['visa', 'mastercard', 'amex', 'discover', 'other']);

/**
 * One importable credential row. Unknown keys are stripped (not rejected) so
 * exports from newer app versions degrade gracefully; known keys must have
 * the right shape or the row is rejected.
 */
export const importedCredentialSchema = z
  .object({
    title: boundedString().optional(),
    username: boundedString().optional(),
    password: boundedString().optional(),
    url: boundedString().optional(),
    notes: boundedString(IMPORT_LIMITS.maxNotesLength).optional(),
    category: credentialCategorySchema.optional(),
    tags: z.array(boundedString(256)).max(IMPORT_LIMITS.maxTags).optional(),
    isFavorite: z.boolean().optional(),
    totpSecret: boundedString(256).optional(),
    cardNumber: boundedString(64).optional(),
    cardholderName: boundedString().optional(),
    expiryMonth: boundedString(16).optional(),
    expiryYear: boundedString(16).optional(),
    cvv: boundedString(16).optional(),
    cardType: cardTypeSchema.optional(),
    billingAddress: boundedString().optional(),
  })
  .strip();

export const importPayloadSchema = z
  .array(importedCredentialSchema)
  .max(IMPORT_LIMITS.maxEntries);

export type ImportedCredential = z.infer<typeof importedCredentialSchema>;

/**
 * Parses and validates a raw import JSON string.
 * @throws Error with a user-facing message when the payload is invalid.
 */
export function parseImportPayload(data: string): ImportedCredential[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('Invalid import data format');
  }

  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (entry ${String(first.path[0])})` : '';
    throw new Error(`Invalid import data format${where}: ${first?.message ?? 'schema mismatch'}`);
  }
  return result.data;
}
