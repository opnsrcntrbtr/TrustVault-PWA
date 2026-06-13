# TrustVault PWA — Security Hardening Plan (June 2026)

**Date:** 2026-06-10 · **Status:** ✅ Delivered (all phases A–E shipped; see `SECURITY.md`, `SECURITY_AUDIT_REPORT.md`)
**Scope:** Closed the remaining open items from `SECURITY_PWA_ENHANCEMENT_PLAN.md` (2026-05-29): S2 strict CSP, S7 key hygiene, P2/P5 supply chain, S8 remainder, plus documentation sync.
**Baseline:** S1 (WebAuthn PRF zero-knowledge biometric), S3, S4, S5 (metadata encryption), S6, and S8 partials were already complete in code as of this date.

Phase order: supply chain first (A, B) — removing `cdn.jsdelivr.net` and dead deps shrinks the CSP allowlist before the strict CSP (C). Key hygiene (D) ran independently. Docs (E) landed last.

---

## Phase A — Remove Dead Dependencies (P5)
Removed unused `argon2-browser` (bundled WASM, historic reason `'unsafe-eval'` was tolerated) and `dexie-encrypted` (beta, unused). Dropped their type declarations and `vite.config.ts` references.

## Phase B — Self-Host Tesseract OCR Assets (P2)
Replaced the ~15MB runtime fetch from `cdn.jsdelivr.net` (no SRI, supply-chain risk) with pinned `tesseract.js@5`/`tesseract.js-core@5`/`eng.traineddata.gz` self-hosted under `public/ocr/`, cached via workbox `CacheFirst`. Removed `CDN_ORIGINS` from `script-src`/`connect-src`.

## Phase C — Strict Hash-Based CSP (S2)
New production `script-src`: `'self' 'sha256-…' 'wasm-unsafe-eval'` — dropped `'unsafe-inline'`/`'unsafe-eval'`. The inline GH-Pages bootstrap script's hash is a constant (`INLINE_BOOTSTRAP_SCRIPT_HASH` in `securityHeaders.ts`) with a drift test that re-hashes `index.html` against it. `style-src 'unsafe-inline'` is a **documented residual** for MUI/Emotion runtime styles.

## Phase D — Key Hygiene (S7): Non-Extractable Keys
Session vault key (`useAuthStore.vaultKey`) is now imported `extractable: false`, restricted to `['encrypt','decrypt']`. Replaced manual `exportKey → encrypt` flows with `crypto.subtle.wrapKey`/`unwrapKey` for `encryptedVaultKey` and the PRF wrap path in `biometricVaultKey.ts`. All transient key-material `Uint8Array`s are zeroized in `finally` blocks. Lock/logout/auto-lock paths null the vault key reference. Storage format stayed byte-compatible (AES-GCM wrap = encrypt of raw key), versioned via `vaultKeyScheme`.

## Phase E — S8 Remainder + Documentation Sync
Added Zod schema validation for `importFromJson`/`.tvault` payloads (field types, lengths, category enum, reject unknown executable content). Confirmed viewport allows user scaling (a11y zoom). Synced `SECURITY.md`, `SECURITY_PWA_ENHANCEMENT_PLAN.md` §0 status table, `ROADMAP.md`, `README.md`, `TEST_STATUS.md`, `SECURITY_AUDIT_REPORT.md`.

---

## Out of Scope (tracked, not done here)
Full strict `style-src` (Emotion nonce/hash), P1 `navigateFallback`, P3 manifest modernization, P4 background sync, hardware-key (YubiKey) roadmap items, encrypted cloud sync.
