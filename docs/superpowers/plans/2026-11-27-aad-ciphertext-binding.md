# AAD Ciphertext Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind every vault ciphertext to its user, record and field, and authenticate `.tvault` headers.

**Architecture:** `core/crypto` gains a canonical AAD builder and optional-AAD `encrypt`/`decrypt`. A single data-layer module owns the row rules, keyed on whether `encryptedPassword` is v2. An idempotent post-unlock pass upgrades legacy rows.

**Tech Stack:** WebCrypto AES-GCM, `@noble/hashes` scrypt, Dexie, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-27-aad-ciphertext-binding-design.md`

## Global Constraints

- No Dexie version bump (WS-K owns v11). No new dependencies.
- Crypto failures throw the existing generic messages (`Failed to decrypt data`). Never log plaintext or keys.
- Integrity title is exactly `Integrity check failed`.
- Export KDF: scrypt N=131072, r=8, p=1, dkLen=32. Accept N a power of two from 131072 to 1048576, r=8, p 1–4, dkLen=32.
- The upgrade pass never changes `updatedAt` and never blocks login.
- `CredentialRepositoryImpl.ts` holds literal NUL bytes (lines ~425, ~432), so use `grep -a`. Task 3 replaces them with the `\u0000` escape.
- `tsc --noEmit` clean, and no new lint problems in touched files compared with `main`.
- Stage only the task's own files. The working tree has unrelated doc changes.

## Review Focus

1. A real pre-upgrade vault with optional fields missing (no URL, notes or tags) must upgrade and read back identically. Test: Task 4.
2. A legacy row with one corrupt optional column must stay untouched and readable, with no data loss. Test: Task 4.
3. An edit made while the upgrade runs must not be overwritten. Test: Task 4.
4. Editing or favouriting an integrity-failed row must be refused and leave its stored bytes unchanged. Test: Task 3.
5. Clearing an optional field (URL set to empty) on a v2 row must read back as empty, not as an integrity error. Test: Task 3.

---

### Task 1: AAD builder and AAD-aware encrypt/decrypt

**Files:** Create `src/core/crypto/aad.ts`, `src/core/crypto/__tests__/aad.test.ts`. Modify `src/core/crypto/encryption.ts`. Test `src/core/crypto/__tests__/encryption-aad.test.ts`.

**Interfaces — Produces:**
- `CREDENTIAL_FIELDS: readonly CredentialField[]`: the 15 `encrypted*` column names of `StoredCredential`, `encryptedPassword` through `encryptedBackupCodes`
- `interface ExportHeader { version: string; exportDate: string; salt: string; kdf: 'scrypt'; kdfParams: { N: number; r: number; p: number; dkLen: number } }`
- `type AadContext = { purpose: 'credential-field'; userId: string; recordId: string; field: CredentialField } | { purpose: 'profile-name'; userId: string; recordId: string } | { purpose: 'vault-key-wrap'; userId: string } | { purpose: 'export'; header: ExportHeader }`
- `buildAad(ctx: AadContext): Uint8Array`
- `encrypt(plaintext: string, key: CryptoKey, aad?: Uint8Array): Promise<EncryptedData>` sets `v: 2` if and only if `aad` is given
- `decrypt(data: EncryptedData, key: CryptoKey, aad?: Uint8Array): Promise<string>`: `v === 2` requires `aad`; no `v` ignores `aad`; any other `v` throws

- [ ] **Step 1: Write failing tests**
  - `buildAad` is deterministic. `(userId "a|b", recordId "c")` differs from `("a", "b|c")`. Changing any one of purpose, userId, recordId, field, or any export header member changes the bytes.
  - v2 round-trips. Wrong user, record, field or purpose rejects with `Failed to decrypt data`.
  - v2 without AAD rejects. v2 with `v` deleted rejects. `v: 3` rejects.
  - Legacy `encrypt(p, k)` has no `v` and decrypts with and without AAD.
- [ ] **Step 2:** `npx vitest run src/core/crypto` → new tests FAIL.
- [ ] **Step 3:** Implement as in Interfaces, with the encoding from the spec table.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(crypto): add canonical AAD binding for AES-GCM`.

### Task 2: Row codec with the per-row anchor

**Files:** Create `src/data/repositories/credentialRowCrypto.ts`, `src/data/repositories/__tests__/credentialRowCrypto.test.ts`.

**Interfaces — Consumes:** Task 1. **Produces:**
- `class IntegrityError extends Error` (message `Integrity check failed`)
- `isV2Row(row: Pick<StoredCredential, 'encryptedPassword'>): boolean`: false on unparsable JSON
- `sealField(value: string, key: CryptoKey, userId: string, recordId: string, field: CredentialField): Promise<string>`
- `openRow(row: StoredCredential, key: CryptoKey, userId: string): Promise<Partial<Record<CredentialField, string>>>` for v2 rows: returns plaintext for each present column, and throws `IntegrityError` if any present column is not v2 or fails to authenticate
- `resealRow(row: StoredCredential, key: CryptoKey, userId: string): Promise<Partial<StoredCredential>>` for sealed legacy rows: returns every present column as v2, verified through `openRow`, plus `userId`; throws `IntegrityError` if any column fails

- [ ] **Step 1: Failing tests.** v2 round-trip. These all throw `IntegrityError`: password blobs swapped between two records; password blob copied into `encryptedUrl`; one legacy column in a v2 row; row opened under another `userId`; profile-name ciphertext placed in a column. `resealRow` preserves every plaintext, omits absent columns, and throws for a corrupt column.
- [ ] **Step 2:** `npx vitest run src/data/repositories/__tests__/credentialRowCrypto.test.ts` → FAIL.
- [ ] **Step 3:** Implement. The module is pure: no Dexie writes.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(data): add credential row crypto with per-row v2 anchor`.

### Task 3: Enforce row rules in the repository and close the sealing hole

**Files:** Modify `CredentialRepositoryImpl.ts`, `metadataSealing.ts`, `src/domain/entities/Credential.ts` (add `integrityError?: boolean | undefined`). Test `__tests__/CredentialRepositoryImpl.integrity.test.ts`.

**Interfaces — Consumes:** Task 2.

- [ ] **Step 1: Failing tests** (fake-indexeddb, tampering through `db.credentials.update`):
  - `create` stores only v2 columns.
  - Delete `encryptedUrl` and add plaintext `url: 'https://evil.example'` → the read has `url === undefined`. Do the same for `title`, `notes` and `tags`.
  - Swapped password blobs → `integrityError: true`, title `Integrity check failed`, `password === ''`, no `url`, `totpSecret`, `cvv` or `cardNumber`. `findAll` still returns the row.
  - Set `isSealed: false` plus an evil `url` on a v2 row, then run `sealLegacyMetadata` → stored `encryptedUrl` unchanged and the evil URL never read.
  - `update` on an integrity-failed row rejects with `IntegrityError`, and the stored row is deep-equal to before. `delete` still works.
  - `update(id, { password })` on a sealed legacy row leaves every present column v2.
  - `update(id, { url: '' })` on a v2 row reads back with no URL and no integrity flag.
  - `canClaim` accepts an unowned v2 row for its owner's key.
  - `analyzeSecurityScore` works on a v2 row.
  - `exportAll` leaves out integrity-failed rows.
- [ ] **Step 2:** Run the new file → FAIL.
- [ ] **Step 3:** Implement. Thread `(userId, recordId, column)` through every encrypt and decrypt call, including the two backup-code calls that bypass the helpers. `canClaim` takes `userId`. `update` calls `resealRow` first on a sealed legacy row, and refuses on `IntegrityError`; unsealed legacy rows are sealed first. `sealLegacyMetadata` filters out `isV2Row`. Replace the NUL bytes with `\u0000`.
- [ ] **Step 4:** `npx vitest run src/data` → PASS. Update an existing assertion only where it encodes behaviour that the spec changes, and list each one in the commit body.
- [ ] **Step 5:** Commit `feat(data): enforce AAD row integrity and block plaintext fallbacks`.

### Task 4: Upgrade pass, profile names and vault-key wrap

**Files:** Create `src/data/repositories/aadMigration.ts` and its test. Modify `ProfileRepositoryImpl.ts`, `profileMigration.ts`, `UserRepositoryImpl.ts` (signup ~45, login ~131–143, post-unlock ~174 and ~308, `registerBiometric` ~450, `changeMasterPassword` ~564–577).

**Interfaces — Produces:** `resealToAadV2(vaultKey: CryptoKey, userId: string): Promise<{ upgraded: number; skipped: number }>`

- [ ] **Step 1: Failing tests**
  - A legacy vault (including a row with no url, notes or tags) upgrades: all v2, plaintexts equal, `updatedAt` unchanged. A second run returns `upgraded: 0`.
  - A row with one corrupt column is byte-identical afterwards and counted in `skipped`; the other rows still upgrade.
  - A row modified between read and write is not overwritten.
  - Another user's rows are untouched. Unsealed rows are untouched.
  - Legacy profile names upgrade, and `ProfileRepository` reads them. A profile-name blob swapped between profiles fails to decrypt.
  - Signup and password change write a v2 wrap. Password login with a legacy wrap (both PBKDF2 and `scrypt-v1`) ends with a v2 wrap and the same vault key. A wrap moved to another user fails to unlock.
  - Both password login and biometric unlock call the pass. If it throws, login still succeeds.
- [ ] **Step 2:** Run them → FAIL.
- [ ] **Step 3:** Implement. Do the WebCrypto work outside the Dexie transaction, then re-check inside it that `updatedAt` and `encryptedPassword` are unchanged before writing.
- [ ] **Step 4:** `npx vitest run src/data` → PASS.
- [ ] **Step 5:** Commit `feat(data): upgrade legacy vaults to AAD-bound ciphertexts`.

### Task 5: Export format 1.1

**Files:** Modify `src/core/crypto/exportEncryption.ts` and its tests, `src/presentation/components/ExportDialog.tsx`.

**Interfaces — Consumes:** `ExportHeader`, `buildAad`. Public signatures of `encryptExport` and `decryptImport` are unchanged.

- [ ] **Step 1: Failing tests**
  - Output has `version: '1.1'` and the specified KDF and parameters, and round-trips.
  - Changing `exportDate`, `salt`, any KDF parameter or `version` (including to `'1.0'`) rejects.
  - N=16384, N=2097152, N=131073, r=1 and p=5 reject **before** key derivation.
  - A committed 1.0 fixture still imports. Generate it with the current code before changing it.
  - Integrity-failed credentials are not in the payload. `ExportDialog` shows how many were skipped.
- [ ] **Step 2:** Run them → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/core/crypto src/__tests__/integration/import-export.test.tsx` → PASS.
- [ ] **Step 5:** Commit `feat(export): authenticated .tvault 1.1 header with scrypt`.

### Task 6: Documentation and full verification

**Files:** Modify `docs/security/SECURITY.md` (threat model, row rules, the "Not protected" list, one-way upgrade), `src/core/crypto/README.md`, `docs/testing/TEST_STATUS.md`, and the `[Decryption Failed]` check in `src/core/breach/unlockBreachRefresh.ts` if it needs to skip integrity rows. Append WS-O onwards (roadmap R2–R7) to `docs/superpowers/plans/2026-08-02-components-pages-tdd-improvement.md`.

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2:** `npx tsc --noEmit -p .` → exit 0. `npm test -- --run` → no failing tests; rerun any timeout on its own and report it. `e2e/` being collected by Vitest is an existing failure. `npm run build` → succeeds.
- [ ] **Step 3:** In the browser (`npm run dev`): sign up, add two credentials, confirm `"v":2` in IndexedDB, swap their `encryptedPassword` values, reload, and confirm both show `Integrity check failed`.
- [ ] **Step 4:** `graphify update .`, then commit `docs: document AAD ciphertext binding`.
