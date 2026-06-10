# TrustVault PWA — Test Plan for Unimplemented / Partially Implemented Features

**Date:** 2026-06-11
**Author:** Automated test-implementation task (Claude)
**Inputs:** `graphify-out/GRAPH_REPORT.md`, `ROADMAP.md`, `TEST_STATUS.md`, `CLAUDE.md`, source survey

---

## 1. Coverage Gap Analysis

Well-covered (no new work needed): crypto core (encryption/password/export encryption + edge cases), WebAuthn PRF stack (biometricVaultKey, webauthnPrf, migration), HIBP service + k-anonymity + P4 offline suite (breachPrefixStore, rangeCache, unlockBreachRefresh), import schema validation (S8), security headers (S2), autofill domain matcher (X3), OCR parser, authStore, usePasswordGenerator, useAutoLock, clipboard, timeFormat.

**Gaps found (feature is shipped or partial, but has zero or inadequate tests):**

| # | Feature / Module | Roadmap tie-in | Status | Existing tests |
|---|------------------|----------------|--------|----------------|
| G1 | `src/presentation/store/credentialStore.ts` | Use Case 1 (session lifecycle — decrypted data must purge on lock) | Implemented | **None** (authStore.test.ts tests a local mock store, not this module) |
| G2 | `src/core/autofill/autofillSettings.ts` | Use Case 2 (autofill opt-in), Phase "Autofill Integration" | Implemented | **None** |
| G3 | `src/core/utils/base64.ts` | Used by WebAuthn/crypto paths (URL-safe + standard b64) | Implemented | **None** (only indirectly exercised) |
| G4 | `src/presentation/hooks/useSwipeGesture.ts` | Phase 4.3 mobile optimization (partial) | Implemented | **None** |
| G5 | `src/presentation/store/themeStore.ts` | Phase 3 display settings | Implemented | **None** |
| G6 | `src/presentation/hooks/useServiceWorkerUpdate.ts` | Phase 6.2 PWA update flow | Implemented | **None** |
| G7 | Import **merge-conflict resolution** | Use Case 5 explicitly lists this as "Remaining" | **Partially implemented** — dedupe lives only inside `ImportDialog.tsx`; `CredentialRepository.importFromJson()` has no dedupe and appends duplicates | importValidation.test.ts covers schema only |

**Unimplemented features where tests cannot meaningfully exist yet** (documented, not tested):

- TOTP SMS / backup codes (ROADMAP: "SMS/backup codes pending") — no source module exists.
- Bulk operations (gap analysis: 50%) and advanced dashboard filters (❌) — no APIs to test.
- E2E (Playwright) suite: repo has no Playwright dependency/config; adding a browser e2e harness is a project-scope decision (new dependency + CI), out of scope for this autonomous run. Integration tests below run the real repository + fake-indexeddb + real crypto, which is the deepest end-to-end layer available under Vitest. Recommendation recorded in §4.

## 2. Test Design

### G1 — credentialStore (unit, Vitest)
File: `src/presentation/store/__tests__/credentialStore.test.ts`
- initial state shape
- setCredentials / addCredential (prepends) / updateCredential (by id, leaves others) / removeCredential
- selectCredential set + clear
- setLoading / setError / setSearchQuery / setFilterCategory
- **security invariant:** `clearCredentials()` empties both `credentials` and `selectedCredential` (lock path must leave no decrypted data in the store)

### G2 — autofillSettings (unit)
File: `src/core/autofill/__tests__/autofillSettings.test.ts`
- secure-by-default: `enabled:false`, `autoSubmit:false`, `requireConfirmation:true`, `onlyHTTPS:true`
- load: missing key → defaults; corrupted JSON → defaults (graceful); partial object → merged with defaults
- save/load round-trip
- `isAutofillEnabledForOrigin`: disabled globally → false; excluded origin → false; HTTP origin with onlyHTTPS → false; HTTPS allowed → true; onlyHTTPS=false allows HTTP
- excludeOrigin idempotent; includeOrigin removes; toggleAutofill persists

### G3 — base64 (unit)
File: `src/core/utils/__tests__/base64.test.ts`
- encode/decode round-trip (Uint8Array and ArrayBuffer inputs)
- URL-safe alphabet decode (`-`/`_`), missing padding restored
- whitespace/newline tolerance
- remainder-1 input throws `Invalid base64 string`
- empty string → '' / empty bytes
- base64url encode strips padding and uses URL alphabet; round-trips with decode

### G4 — useSwipeGesture (unit, renderHook)
File: `src/presentation/hooks/__tests__/useSwipeGesture.test.ts`
- left swipe ≥ threshold fires `onSwipeLeft` only
- right swipe fires `onSwipeRight` only
- sub-threshold movement fires neither
- touchEnd without touchStart/touchMove is a no-op
- custom `minSwipeDistance` honored

### G5 — themeStore (unit)
File: `src/presentation/store/__tests__/themeStore.test.ts`
- default mode dark
- toggleTheme flips both ways; setTheme sets explicit mode
- persists under `trustvault-theme` localStorage key

### G6 — useServiceWorkerUpdate (unit, mocked SW registration)
File: `src/presentation/hooks/__tests__/useServiceWorkerUpdate.test.ts`
- no `navigator.serviceWorker` → `checkForUpdate` sets unsupported-browser error
- registration without waiting worker → no update flagged
- registration with waiting worker → `updateAvailable:true` after `checkForUpdate`
- `dismissUpdate` stores the waiting worker scriptURL in sessionStorage and clears the flag
- `installUpdate` posts `{type:'SKIP_WAITING'}` to the waiting worker
- `installUpdate` with no waiting worker → error

### G7 — import merge behavior (integration, real repo + fake-indexeddb + real crypto)
File: `src/data/repositories/__tests__/importMerge.test.ts`
- export → wipe → import round-trip preserves count and decrypted fields
- re-importing the same payload **duplicates rows at the repository layer** (documents that merge-mode dedupe is UI-only — the "Remaining: merge-conflict resolution" roadmap item)
- imported rows are encrypted at rest (no plaintext password in stored rows)
- rows rejected by S8 schema cause a thrown error before any write (oversized payload)

## 3. Constraints honored

- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), path aliases `@/...`
- React Testing Library `renderHook`/`act` for hooks (React 19 safe)
- No weakening of crypto invariants; integration test uses real PBKDF2/AES-GCM
- Lint baseline (~853/855 problems) is approved — only **new** problems count
- Scrypt-heavy suites avoided where possible (G7 derives the vault key via PBKDF2 directly instead of creating a user through scrypt)

## 4. Recommendations (not done in this run)

1. Add Playwright e2e harness (install `@playwright/test`, port the manual P1/P4 drills from TEST_STATUS.md into CI-able specs).
2. Extract `ImportDialog`'s merge/duplicate detection into a pure helper (e.g. `src/core/vault/importMerge.ts`) so dedupe is testable and reusable by the repository layer; then add repo-level merge mode.
3. Implement TOTP backup codes before writing their tests.
