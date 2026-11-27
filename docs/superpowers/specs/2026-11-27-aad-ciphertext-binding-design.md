# Design: Authenticated ciphertext binding (AAD) + `.tvault` 1.1

**Date:** 2026-11-27 · **Status:** awaiting re-approval (see next section)

## Changes from the approved plan

Reading the unlock, read and sealing paths showed that the approved design did not hold. Please check these before implementation.

1. **The `vaultFormat: 2` marker is removed. Each row is now its own anchor.** Biometric unlock never touches `encryptedVaultKey`, so it could neither authenticate the marker nor finish a migration gated on it. Flipping the marker would have silently re-enabled legacy reads. New rule: if a row's `encryptedPassword` is v2, the whole row is v2.
2. **Plaintext fallback columns were a bigger hole than ciphertext swapping.** `decryptCredential` falls back to plaintext `url`, `title`, `notes` and card columns. An attacker can keep a valid `encryptedPassword`, delete `encryptedUrl` and add `url: "https://evil.example"`. AAD alone does not stop this. v2 rows now ignore every plaintext column.
3. **`sealLegacyMetadata` must skip v2 rows.** It runs at every login. Setting `isSealed: false` and adding a plaintext `url` would make the app encrypt the attacker's value into the row.
4. **Failures become an explicit `integrityError` flag.** Today a failed decrypt returns `'[Decryption Failed]'` or silently `undefined`, and the next edit can overwrite the real ciphertext.
5. **`update()` upgrades the whole row to v2 before a partial write.**
6. **No `allowLegacy` option.** `decrypt()` follows the ciphertext's own `v`. The repository decides policy per row.

## Intent

Stop someone who can **write IndexedDB at rest** from making TrustVault accept moved, substituted or injected credential data. This is also required before any future sync work. Basis: Scarlata et al., *Zero Knowledge (About) Encryption*, USENIX Security 2026 / IACR ePrint 2026/058. That paper assumes a malicious server; TrustVault has none, so this is the local analogue and not the same vulnerability.

## Goals

- Each ciphertext is bound to its user, record and field.
- A v2 row yields either authentic data or `integrityError`, with no secrets and no URL.
- Existing vaults upgrade without user action, via password or biometric unlock.
- The `.tvault` header is authenticated, and the export KDF is memory-hard.

## Non-goals

HKDF per-purpose subkeys (R1b), the biometric PRF wrap (owned by `webauthn-prf-zktv`), the Chrome extension (it reads no ciphertext), a Dexie schema bump, and new dependencies.

## Not protected (document in SECURITY.md)

- Anyone holding an **earlier copy** of the database can restore old rows, or replay old v1 blobs as a legacy row. This includes full or per-row rollback.
- Tampering done **before** a row is upgraded is accepted and carried forward (trust on first use).
- Deleting a whole row, or a whole optional ciphertext, reads as "empty". Autofill skips credentials without a URL.
- Unencrypted index fields are not authenticated: `category`, `isFavorite`, `profileId`, timestamps, `securityScore`.
- In-origin XSS after unlock.

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| Vault-level format marker + legacy flag | The marker is attacker-writable and cannot be authenticated on biometric unlock | Rejected |
| Rotate the vault key during migration, so old blobs stop decrypting | Strongest, but breaks every biometric wrap and needs re-enrolment | Rejected for now |
| **Per-row anchor on `encryptedPassword`** | Simple and works on both unlock paths; leaves the rollback residual above | **Chosen** |

## Design

**Ciphertext format.** `EncryptedData` gains `v?: 2`. v2 means AES-GCM with `additionalData`. No `v` means legacy. Any other value is an error.

**AAD encoding.** Each part is a 4-byte big-endian length followed by its UTF-8 bytes.

| Purpose | Parts, after `"tv-aad"`, `"2"` |
|---|---|
| `credential-field` | purpose, userId, recordId, column name |
| `profile-name` | purpose, userId, profileId |
| `vault-key-wrap` | purpose, userId |
| `export` | purpose, version, exportDate, salt, kdf, N, r, p, dkLen |

**Row rules.**
- *v2 row:* every encrypted column that is present must be v2 and must authenticate under its own column name. Plaintext columns are ignored. Any failure marks the whole row `integrityError`: title `Integrity check failed`, empty username and password, no URL, notes, TOTP or card data.
- *Legacy row:* read as today, except that if it fails to decrypt it is locked like a failed v2 row (changed after review: the old plaintext fallback let one write downgrade a v2 row).
- *Sealing (changed after review):* needs decryption proof for every row and writes v2 directly.
- *New and updated rows:* always v2.

**Integrity-failed rows** cannot be updated (delete still works). They are left out of export, and the export dialog says how many were skipped.

**Upgrade.** `resealToAadV2(vaultKey, userId)` runs after `sealLegacyMetadata` on password **and** biometric unlock.
- It handles sealed legacy rows that the user owns or can claim, and their profile names.
- For each row: decrypt every present column, re-encrypt with AAD, verify that it decrypts, then write the row in one transaction, only if it has not changed since it was read.
- If any column fails, the row is left as it was.
- It does not change `updatedAt`, because the "old password" audit depends on it.
- It is idempotent, and a failure never blocks login.

**Vault-key wrap.** Written as v2 at signup and password change. A legacy wrap is upgraded when the master password is available (password login, folded into the existing KDF upgrade, and biometric enrolment). Biometric unlock does not use the wrap.

**Export 1.1.** Uses scrypt N=2^17, r=8, p=1, dkLen=32. The header is the AAD. Accepted parameters are N a power of two from 2^17 to 2^20, r=8, p from 1 to 4, dkLen=32; the upper limits stop a crafted file exhausting memory. 1.0 files still import.

## Left to the builder

Internal helper names beyond the plan's interfaces, and test fixtures.

## Compatibility note

Once a vault is upgraded, an **older build cannot read it** (for example a stale service-worker tab, or a rollback deploy). This is one-way. Export a backup before deploying.
