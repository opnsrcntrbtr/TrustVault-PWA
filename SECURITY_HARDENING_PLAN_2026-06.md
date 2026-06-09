# TrustVault PWA — Security Hardening Plan (June 2026)

**Date:** 2026-06-10
**Scope:** Close the remaining open items from `SECURITY_PWA_ENHANCEMENT_PLAN.md` (2026-05-29): S2 strict CSP, S7 key hygiene, P2/P5 supply chain, S8 remainder, plus documentation synchronization.
**Baseline:** S1 (WebAuthn PRF zero-knowledge biometric), S3, S4, S5 (metadata encryption), S6, and S8 partials are verified complete in code as of this date. This plan covers only what remains.
**Decisions (Ian, 2026-06-10):** All four streams in scope · plan → approval → phased implementation · `style-src 'unsafe-inline'` retained as documented residual (MUI/Emotion) · validation = project gates + build/preview smoke.

---

## Phase Order Rationale

Supply chain first (A, B) because removing `cdn.jsdelivr.net` and dead deps shrinks the CSP allowlist, making the strict CSP (C) simpler and testable in one pass. Key hygiene (D) is independent but touches crypto/auth, so it runs alone with the integration-test gate. Docs (E) land last so they describe the final state.

---

## Phase A — Remove Dead Dependencies (P5)

**Risk addressed:** Unused `argon2-browser` (~bundled WASM) and `dexie-encrypted` (beta) ship attack surface and bundle weight; argon2 is the historic reason `'unsafe-eval'` was tolerated.

Steps:
1. Confirm zero runtime imports: `grep -rn "argon2\|dexie-encrypted" src/` (expect only type declarations / comments).
2. `npm uninstall argon2-browser dexie-encrypted`.
3. Remove `src/types/argon2*.d.ts` declarations, `optimizeDeps.exclude` entries and any `manualChunks`/alias references in `vite.config.ts`.
4. Re-run bundle analysis (`npm run analyze:bundle`) and record delta.

**Validation:** `npm run type-check && npm run lint && npm run test` → all green; `npm run build` succeeds; no `argon2` artifacts in `dist/`.

**Rollback:** single revert commit; no data/schema impact.

---

## Phase B — Self-Host Tesseract OCR Assets (P2)

**Risk addressed:** Runtime fetch of ~15 MB from `cdn.jsdelivr.net` with no SRI = supply-chain injection vector inside a password manager origin; also keeps a CDN origin in `script-src`/`connect-src`.

Steps:
1. Copy pinned versions of `tesseract.js@5` worker, `tesseract.js-core@5` SIMD WASM, and `eng.traineddata.gz` into `public/ocr/` (exact files referenced at `tesseractService.ts:127-129`).
2. Point `workerPath`/`corePath`/`langPath` at `/ocr/…` (respect Vite `base` for GH Pages).
3. Service worker: add the `.traineddata.gz`/WASM to runtime `CacheFirst` (not precache — too large for precache budget); confirm `wasm` already in cached globs.
4. Remove `CDN_ORIGINS` from `script-src` and `connect-src` in `src/config/securityHeaders.ts`; update `vercel.json` via the parity-tested path.
5. Update `securityHeaders.test.ts` expectations.

**Validation:** project gates; `npm run build && npm run preview` → OCR capture works fully offline (DevTools offline mode); no requests to jsdelivr in the network panel; headers parity test green.

**Rollback:** revert commit restores CDN paths; no data impact.

---

## Phase C — Strict Hash-Based CSP (S2)

**Risk addressed:** `script-src 'unsafe-inline' 'unsafe-eval'` neutralizes the primary XSS defense. For a zero-knowledge vault, XSS-driven exfiltration is the top realistic threat; S1/S5 already assume CSP does its job.

Steps:
1. Compute SHA-256 of the inline GH-Pages redirect script (`index.html:21-33`). Store as a constant `INLINE_BOOTSTRAP_SCRIPT_HASH` in `securityHeaders.ts`.
2. Add a unit test that reads `index.html`, extracts the inline script body, hashes it, and asserts it matches the constant — prevents silent drift between markup and policy.
3. New `script-src`: `'self' 'sha256-…' 'wasm-unsafe-eval'`. Drop `'unsafe-inline'` and `'unsafe-eval'`. (Tesseract WASM needs only `'wasm-unsafe-eval'` once self-hosted.)
4. `style-src` keeps `'unsafe-inline'` — documented residual for MUI/Emotion runtime styles (decision above); add rationale comment in `securityHeaders.ts`.
5. Verify the inline `<style>` block and loading spinner are unaffected (style-src unchanged).
6. `vercel.json` parity via the drift-guard test.

**Validation:** project gates; build/preview smoke with the production policy: app boots (no CSP violations in console), sign-in/unlock works, OCR runs (WASM), HIBP breach check fires, PWA installs. Record results in `TEST_STATUS.md`.

**Risks:** any future inline script silently breaks under hash CSP — the drift test in step 2 is the guard. React/Vite emit no inline scripts in production builds by default.

---

## Phase D — Key Hygiene (S7): Non-Extractable Keys

**Risk addressed:** Vault `CryptoKey` is created extractable and raw key bytes transit JS heap (`exportKey` in `encryption.ts`, `biometricVaultKey.ts`, `UserRepositoryImpl.ts`), enlarging the memory-disclosure window.

Design:
1. **Session vault key non-extractable.** The key held in `useAuthStore.vaultKey` is imported with `extractable: false` and usages restricted to `['encrypt','decrypt']`.
2. **Wrap, don't export.** Replace manual `exportKey → encrypt bytes` flows with `crypto.subtle.wrapKey`/`unwrapKey` (AES-GCM) for: (a) `encryptedVaultKey` under the password-derived KEK, (b) PRF wrap path in `biometricVaultKey.ts` (HKDF wrap key already non-extractable — verify). Raw vault-key bytes then never materialize in JS.
3. **Zeroization.** Any transient `Uint8Array` key material (PRF output, derived bits, decrypted key bytes during migration of existing users) is `.fill(0)` in `finally` blocks.
4. **Lifecycle purge.** Audit lock/logout/auto-lock paths: vault key reference nulled, no copies in closures, clipboard timers cleared. Add a memory-security test asserting the session key is non-extractable (`exportKey` on it must throw).
5. **Migration note:** stored `encryptedVaultKey` format may stay byte-compatible (AES-GCM wrap = encrypt of raw key); confirm round-trip with existing fixtures before changing any storage format. If format must change, version it (`vaultKeyScheme`) like prf-v1 did.

**Validation (crypto/auth change — strictest gate):** `npm run type-check && npm run lint && npm run test` all green **and** `npm run test -- src/test/integration.test.ts` — the Zero-Knowledge invariant (PRF-wrapped vault not decryptable with master password alone) must pass. Manual drill: sign-up → enroll biometric → lock → unlock via PRF → unlock via password, recorded in `TEST_STATUS.md` and `SECURITY_AUDIT_REPORT.md`.

**Rollback:** keep changes behind small, per-call-site commits; storage format unchanged unless versioned.

---

## Phase E — S8 Remainder + Documentation Sync

1. **Zod import validation:** schema for vault JSON (`importFromJson`) and `.tvault` payload post-decrypt — field types, lengths, category enum, reject unknown executable-ish content; clear user-facing error on invalid file. Unit tests for malformed/oversized/wrong-shape inputs.
2. **a11y zoom:** ensure viewport meta allows user scaling (no `user-scalable=no`, `maximum-scale` ≥ 5); Lighthouse a11y check stays ≥ 90.
3. **Doc sync:**
   - `SECURITY.md`: replace stale CSP block with reference to `securityHeaders.ts`, document HIBP egress + k-anonymity + toggle, breach detection no longer "future", update last-updated.
   - `SECURITY_PWA_ENHANCEMENT_PLAN.md` §0 status table: mark S1/S5 done (already shipped), then S2/S7/S8/P2/P5 as delivered by this plan.
   - `ROADMAP.md`, `README.md` touchpoints; `TEST_STATUS.md` manual verifications; `SECURITY_AUDIT_REPORT.md` entries for C/D.
   - `graphify update .` after code changes.

**Validation:** project gates; docs cross-checked against shipped code (no aspirational claims — the failure mode the May plan flagged).

---

## Final Verification (Phase F)

- `npm run type-check && npm run lint && npm run test` — zero errors, zero warnings, all green.
- `npm run test -- src/test/integration.test.ts` — ZK invariant.
- `npm run build && npm run preview` — CSP headers served as specified, app boot smoke, OCR offline, HIBP online, no console CSP violations.
- `npm audit --audit-level=moderate` after dependency removals.

## Out of Scope (tracked, not done here)

Full strict `style-src` (Emotion nonce/hash), P1 `navigateFallback`, P3 manifest modernization, P4 background sync, hardware-key (YubiKey) roadmap items, encrypted cloud sync.
