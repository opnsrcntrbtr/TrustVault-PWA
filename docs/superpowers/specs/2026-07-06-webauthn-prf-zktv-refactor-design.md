# Design: Refactor TrustVault-PWA onto `webauthn-prf-zktv`

**Date:** 2026-07-06
**Status:** Approved
**Package:** [`webauthn-prf-zktv`](https://www.npmjs.com/package/webauthn-prf-zktv) — WebAuthn PRF-backed vault key wrapping (HKDF-SHA256 → AES-256-GCM), extracted from this app and published as the reference implementation for the accompanying research paper.

## Goal

Replace TrustVault-PWA's inline WebAuthn-PRF and vault-key-wrapping code with the
`webauthn-prf-zktv` npm package, so the app consumes the canonical, independently
tested implementation instead of maintaining a duplicate.

## Decisions (user-confirmed)

1. **Scope:** replace crypto + WebAuthn ceremonies. Keep Dexie storage (do NOT
   adopt the package's `ZktvDb` IndexedDB module).
2. **Migration:** lazy re-wrap on unlock via `fromTrustVaultRecord` — existing
   enrolled users keep working with zero extra prompts and zero data loss.
3. **Password path:** untouched. The existing PBKDF2/scrypt master-password
   unlock (`encryptedVaultKey`) remains the passkey-loss safety net; no `pw-v1`
   records are created.
4. **Rollout:** direct swap with full test parity. No runtime feature flag; the
   master-password fallback is the safety net if biometric regresses.

## Current state (refactor surface)

| Inline module | Lines | Fate |
|---|---|---|
| `src/core/auth/biometricVaultKey.ts` | 119 | **Deleted** — package core (`wrapSecret`/`unwrapSecret`/`deriveWrapKeyFromPrf`/`generateSalt`/`zeroize`) |
| `src/core/auth/webauthn.ts` | 553 | **Shrunk to ~120-line app layer** — ceremonies/detection move to `webauthn-prf-zktv/webauthn` |
| `src/core/auth/biometricMigration.ts` | 48 | **Kept** — legacy device-key strip is orthogonal |

Consumers: `UserRepositoryImpl.ts` (enroll `registerBiometric`, unlock
`authenticateWithBiometric`, both via lazy `import()`), `BiometricSetupDialog.tsx`,
`LoginPage.tsx`, `database.ts` (legacy strip only).

Key incompatibility: the package uses HKDF info label
`'webauthn-prf-zktv vault key wrap v1'` and a versioned JSON record envelope
(`"v": 1`); the app's stored records use the legacy label
`'TrustVault Vault Key Wrapping v1'` and raw `EncryptedData` JSON. The package
ships `fromTrustVaultRecord` exactly for this one-shot re-wrap (same PRF output
unlocks both labels, so no extra ceremony is needed).

## Design

### 1. Dependencies

- Add `webauthn-prf-zktv` from the npm registry. Its single runtime dependency
  (`@noble/hashes`) is already a direct app dependency — no new transitive surface.
- Remove `@simplewebauthn/browser` and `@simplewebauthn/types` (only consumed by
  the inline `webauthn.ts`; the package uses native `navigator.credentials`).
- No Vite config changes expected: ESM-only, pure WebCrypto, no WASM.

### 2. `src/core/auth/webauthn.ts` — thin app layer

Keeps only what the package deliberately does not own:

- `isBiometricAvailable()` — retains the Capacitor native-app hard-off gate
  (`isNativeApp()` — PRF does not traverse Android WebView → Credential Manager),
  then delegates to package `isPrfViableOnThisClient()` (whose
  `environment: 'webview'` report reinforces the same policy).
- `getDeviceName()`, `getAuthenticatorInfo()` — app UX helpers, unchanged.
- Re-exports package `detectPrfSupport` (replacing inline
  `detectPRFSupport`/`isPRFSupported`; the tri-state
  `'supported' | 'unsupported' | 'unknown'` shape is identical, so `PRFSupport`
  becomes a type re-export).

Deleted inline functions and their package replacements:

| Deleted | Replacement |
|---|---|
| `registerBiometric`, `registerCredentialWithPRF` | `enrollPrfCredential` / `enrollVault` (adaptive: single ceremony when the authenticator evaluates PRF at create — Chrome 147+) |
| `authenticateBiometric`, `getPRFOutput` | `evaluatePrf` (includes challenge/origin/counter replay verification) |
| `verifyRegistrationResponse`, `verifyAuthenticationResponse` | built into package ceremonies |
| `generatePrfSalt` (biometricVaultKey) | `generateSalt` |
| `deriveWrapKeyFromPRF`, `wrapVaultKeyWithPRF`, `unwrapVaultKeyWithPRF` | `deriveWrapKeyFromPrf`, `wrapSecret`, `unwrapSecret` |

### 3. Repository layer (`UserRepositoryImpl.ts`)

**Enrollment (`registerBiometric`)** — master-password confirmation and raw
vault-key recovery stay as-is. The ceremony + wrap block is replaced by one
package call:

```ts
const { record, credentialId, counter } = await enrollVault({
  enroll: { rpId, rpName: 'TrustVault', userId, userName, userDisplayName },
  secret: vaultKeyRaw,   // zeroized by caller in finally, as today
});
// store serializeRecord(record) in the existing wrappedVaultKey column
```

Dexie schema unchanged: `wrappedVaultKey` now holds a serialized v1 record
instead of legacy `EncryptedData` JSON; `vaultKeyScheme: 'prf-v1'` semantics are
preserved and the two formats are distinguished by `parseRecord` success, not by
a schema bump.

**Unlock (`authenticateWithBiometric`)** — dual-format read with lazy migration:

1. `parseRecord(credential.wrappedVaultKey)` succeeds → new format →
   `unlockVault({ credentialId, record, rpId, storedCounter })` → non-extractable
   AES-256-GCM `CryptoKey` (matches current S7 posture).
2. `parseRecord` throws `RecordFormatError` → legacy record → one `evaluatePrf`
   ceremony (same single biometric prompt), then `fromTrustVaultRecord({
   legacyJson, prfOutput, prfSalt })` re-wraps; `unwrapSecret` unlocks; persist
   `serializeRecord(record)` over the legacy value. Next unlock takes path 1.
3. Counter updates keep writing to the existing Dexie credential row.
4. Advisory: decode `readAuthenticatorFlags` BE/BS bits and store/log them so the
   soft counter check on synced passkeys (counter 0) is an explicit, documented
   policy rather than an accident.

The legacy adapter path (step 2) is removable after a deprecation window once
telemetry/releases indicate all active users have migrated.

### 4. UI layer

`BiometricSetupDialog.tsx` and `LoginPage.tsx` only need import swaps to the new
thin `webauthn.ts` re-exports. No behavior change required; setup-dialog copy may
later note single-prompt enrollment on capable browsers.

### 5. Error handling

Package errors are typed `ZktvError` subclasses with stable `.code` values;
`DecryptError` is deliberately generic (no wrong-key vs corrupt-data leak). A
single `mapZktvError()` helper in the repo layer translates codes to the existing
user-facing strings ("Biometric needs to be re-enabled…", "please use your
master password…") so UI copy stays centralized and no key material or cause
chains reach logs.

### 6. Testing

- Port `webauthnPrf.test.ts`, `biometricVaultKey.test.ts`,
  `webauthn-security.test.ts` assertions to the new seams. Many collapse: the
  package tests its own crypto/ceremonies; app tests focus on repo-layer
  orchestration, error mapping, and Dexie persistence.
- New migration tests: legacy fixture → re-wrap → unlock → record replaced;
  wrong PRF output → generic failure; malformed record → re-enroll message;
  migrated record round-trips on second unlock without the adapter.
- `biometricMigration.test.ts` (device-key strip) unchanged.
- Definition of done (repo CLAUDE.md): `npm run type-check` 0 errors,
  `npm run lint` 0 warnings, targeted `npm run test` green, docs refreshed
  (`SECURITY.md`, `PHASE_4.1_BIOMETRIC_AUTH.md`, `CLAUDE.md`,
  `TEST_STATUS.md` manual-verification entry), `graphify update .` run.

### 7. Out of scope

- Master-password unlock path, PBKDF2-600k / scrypt KDFs, `encryptedVaultKey`.
- Package `ZktvDb` IndexedDB module (Dexie remains the single store).
- `pw-v1` password-wrap records.
- Chrome extension, TOTP, backup codes, rate limiter, username migration.

## Phasing (4 PRs)

1. **Install + detection swap** — add package; rewrite `webauthn.ts` as the thin
   layer; swap `LoginPage`/`BiometricSetupDialog` detection imports; inline
   ceremonies still used by the repo layer (temporarily both present).
2. **Enrollment path** — `registerBiometric` → `enrollVault`; new records are
   package-format; unlock still reads both formats via the inline path.
3. **Unlock path + lazy migration** — `authenticateWithBiometric` →
   `parseRecord`/`unlockVault` + `fromTrustVaultRecord` fallback; migration tests.
4. **Cleanup** — delete `biometricVaultKey.ts` and dead `webauthn.ts` code; drop
   `@simplewebauthn/*`; error-mapping consolidation; docs + security-audit note;
   `graphify update .`.

Each PR independently satisfies the Definition of Done; biometric remains
functional at every intermediate state because the master-password path is never
touched.
