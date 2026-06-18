/**
 * Domain Entity: VaultProfile
 * Represents a logical partition of a user's vault (Personal, Work, etc.)
 *
 * Profiles share the user's single master vault key (Iteration 1 — see
 * ROADMAP.md Phase 7 §7.3). `name` is encrypted at rest for consistency with
 * the S5 metadata-encryption stance; `type`/`accentColor`/`icon`/`isDefault`
 * are non-identifying index fields and remain plaintext.
 */
export type VaultProfileType = 'personal' | 'work' | 'shared_family' | 'custom';

export interface VaultProfile {
  id: string;
  name: string; // decrypted in memory only
  type: VaultProfileType;
  accentColor?: string | undefined;
  icon?: string | undefined;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date | undefined;
}

export interface VaultProfileInput {
  name: string;
  type: VaultProfileType;
  accentColor?: string | undefined;
  icon?: string | undefined;
  isDefault?: boolean;
}
