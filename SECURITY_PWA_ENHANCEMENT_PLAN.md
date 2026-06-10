# TrustVault PWA — Security & PWA Architecture Enhancement Plan

**Date:** 2026-05-29
**Scope:** Cybersecurity hardening + state-of-the-art PWA architecture for the core feature set
**Method:** Knowledge-graph map (`graphify-out/GRAPH_REPORT.md`, 3,207 nodes) → direct source review of the crypto/auth/storage/transport surface → cross-validation against the project's own `SECURITY_AUDIT_REPORT.md` → web research grounded to May 2026 best practices.
**Baseline reviewed at commit:** `1557a82`

> This plan **validates and extends** the existing `SECURITY_AUDIT_REPORT.md` (dated Jan 2025, with May-2026 patch notes). Where my findings agree with that audit I say so; where the audit is **stale, aspirational, or understated** I flag it explicitly. The recurring theme: the audit describes an *intended* posture (4.5/5) that the *deployed* code does not fully match.

---

## 0. Implementation Status (updated 2026-06-10; originally 2026-05-29)

| ID | Status | Tests | Notes |
|----|--------|-------|-------|
| **S3** — HIBP allowed in `connect-src` | ✅ Done | `src/config/__tests__/securityHeaders.test.ts` | breach detection no longer blocked by CSP |
| **S6** — HSTS + COOP/CORP headers | ✅ Done | same | + `X-XSS-Protection: 0` per OWASP |
| **S2** — strict hash-based CSP | ✅ Done (2026-06-10) | same (incl. inline-script hash drift guard) | `script-src 'self' 'sha256-…' 'wasm-unsafe-eval'` — no `unsafe-inline`/`unsafe-eval`; `style-src 'unsafe-inline'` kept as documented MUI/Emotion residual; dev-only relaxed variant (`DEV_SECURITY_HEADERS`) never ships |
| **Config drift guard** | ✅ Done | same | canonical `src/config/securityHeaders.ts`; `vercel.json`↔Vite parity enforced by test |
| **S4** — scrypt `N=2^17` + rehash-on-login | ✅ Done | `password.test.ts`, `password-edge-cases.test.ts`, `UserRepositoryImpl.test.ts` | legacy hashes still verify and upgrade transparently |
| **S8** — error sanitization | ✅ Done | `encryption.test.ts` | decrypt no longer leaks "key/corrupt" |
| **S8** — constant-time verify + console cleanup | ✅ Done | `password.test.ts` | routed through `constantTimeEqual` |
| **S8** — rate-limit decay | ✅ Done | `rateLimiter.test.ts` | counter resets after 1h idle |
| **S1** — WebAuthn PRF unlock | ✅ Done (2026-05) | `biometricVaultKey.test.ts`, `UserRepositoryImpl.test.ts` | `vaultKeyScheme: 'prf-v1'`; legacy creds stripped by DB v6 migration |
| **S5** — encrypt metadata at rest | ✅ Done (2026-05) | `metadataEncryption.test.ts` | sealed transparently on login via `sealLegacyMetadata` |
| **S7** — non-extractable keys | ✅ Done (2026-06-10) | `biometricVaultKey.test.ts`, `UserRepositoryImpl.test.ts` (S7 cases), `integration.test.ts` | session vault keys non-extractable on both unlock paths; transient key material zeroized; biometric enroll now confirms the master password instead of exporting the session key |
| **S8** — zod import validation, a11y zoom | ✅ Done (2026-06-10) | `importValidation.test.ts` | schema-validated imports; viewport allows user scaling (WCAG 1.4.4) |
| **P2** — self-host Tesseract (no CDN) | ✅ Done (2026-06-10) | `securityHeaders.test.ts` | assets served from `public/ocr/` via `scripts/copy-ocr-assets.js`; `cdn.jsdelivr.net` removed from CSP |
| **P5** — remove dead deps | ✅ Done (2026-06-10) | type-check/build | `argon2-browser` + `dexie-encrypted` uninstalled; bundled argon2 asset deleted |
| **P1** — offline deep-link navigation | ✅ Done (2026-06-10) | build + manual offline drill | `navigateFallback: 'index.html'` + denylist (API/OCR/assets); spec: `docs/superpowers/specs/2026-06-10-pwa-offline-suite-design.md` |
| **P3** — manifest modernization | 🟡 Code done (2026-06-10) | build + manifest inspection | `id`, `display_override`, `launch_handler`, `categories`, 3 `shortcuts`; **screenshots pending** (Playwright capture against preview) |
| **P4** — background breach re-checks | ✅ Done (2026-06-10) | `breachPrefixStore.test.ts`, `rangeCache.test.ts`, `unlockBreachRefresh.test.ts` | DB v8 `breachPrefixes` (5-char SHA-1 prefixes, no new disclosure), `sw-periodic-sync.js` range prefetch, on-unlock 7-day fallback in all browsers |

> **2026-06-10 update** (delivered per `SECURITY_HARDENING_PLAN_2026-06.md`):
> the placeholder ZK checks in `src/test/integration.test.ts` were replaced
> with a REAL invariant test — a PRF-wrapped vault key must not decrypt with
> the master password alone, exercised against the production crypto modules.

**Validation:** `npm run type-check` → 0 errors · `npm run build` → success · 207/208 touched-suite tests pass (the 1 failure is a **pre-existing** TOCTOU race in `createUser`, unrelated to these changes — see §7).

---

## 1. Executive Summary

TrustVault has a genuinely strong cryptographic core (AES-256-GCM, PBKDF2-600k, scrypt, `@noble/hashes`, CSPRNG, k-anonymity HIBP) and clean architecture. The recent fixes (rate limiting, WebAuthn ceremony verification, removal of localStorage generator prefs) are real improvements.

However, the deep review surfaced **one architectural-critical issue, two high-severity gaps, and several medium issues** that the existing audit either missed, understated as "by design," or described aspirationally without the code matching:

| ID | Severity | Title | Audit status |
|----|----------|-------|--------------|
| **S1** | 🔴 Critical | Biometric unlock is not a cryptographic boundary — vault key is recoverable from IndexedDB alone | **Missed** (audit "fixed" only ceremony replay, not the root design) |
| **S2** | 🟠 High | Deployed CSP uses `'unsafe-inline'` + `'unsafe-eval'`; audit claims a strict `'wasm-unsafe-eval'` CSP that does not exist | **Contradicts audit** |
| **S3** | 🟠 High | CSP `connect-src` omits HIBP endpoints → breach detection is broken under the production CSP, and audit's "no network communication" claim is now false | **Stale / contradicts audit** |
| **S4** | 🟡 Medium | scrypt `N=2^15` is below the current OWASP minimum of `2^17` | **Understated** (audit calls it compliant) |
| **S5** | 🟡 Medium | Sensitive metadata (username, URL, card fields, legacy notes, tags, title) stored in plaintext at rest | **Understated** ("Low, by design") |
| **S6** | 🟡 Medium | No HSTS / COOP / COEP / CORP headers; no SRI on CDN assets despite audit claiming SRI | **Partly contradicts audit** |
| **S7** | 🟡 Medium | Extractable vault keys held in memory; weak key hygiene | Acknowledged (M2) |
| **S8** | 🔵 Low | Information-leaking error strings, sensitive `console.*`, non-validated import, no zoom (a11y) | Partly acknowledged |

| ID | Area | Title |
|----|------|-------|
| **P1** | Offline resilience | `navigateFallback: null` + CDN-hosted Tesseract/fonts break offline deep-links and offline OCR |
| **P2** | Supply chain | Runtime dependency on `cdn.jsdelivr.net` (Tesseract ~15 MB) with no SRI/self-hosting |
| **P3** | Manifest | Minimal manifest — missing `id`, `display_override`, `launch_handler`, `shortcuts`, `screenshots` |
| **P4** | Update UX | Update flow is sound (`registerType: 'prompt'`); add background-sync breach re-checks |
| **P5** | Dead weight | `argon2-browser` + `dexie-encrypted` shipped but unused → bundle + attack surface |

**Top recommendation:** Adopt the **WebAuthn PRF extension** to make biometric/passkey unlock a true cryptographic gate (this is now the industry standard — Bitwarden, Dashlane), and move to a **hash-based strict CSP** that drops `unsafe-inline`/`unsafe-eval`. These two changes convert the app from "claims zero-knowledge" to "demonstrably zero-knowledge under realistic attacker models (XSS, device extraction)."

---

## 2. Security Findings (detailed)

### S1 — 🔴 Critical: Biometric unlock provides no cryptographic protection

**Location:** [`src/core/auth/biometricVaultKey.ts:23-55`](src/core/auth/biometricVaultKey.ts), [`src/data/repositories/UserRepositoryImpl.ts:138-194`](src/data/repositories/UserRepositoryImpl.ts), [`src/core/auth/webauthn.ts:227-276`](src/core/auth/webauthn.ts)

**Evidence:** The device key that wraps the vault key is derived entirely from material stored in IndexedDB:
```ts
// biometricVaultKey.ts
const keyMaterial = `${credentialId}:${userId}`;   // both stored in IndexedDB
// + salt (also stored in IndexedDB) → PBKDF2 → AES-GCM key
```
`authenticateWithBiometric()` calls `verifyAuthenticationResponse()` (the recent C1 fix), but that verification runs **in client JavaScript the attacker controls**, and the vault-key decryption does **not** consume any secret produced by the authenticator. An attacker who obtains the IndexedDB contents (via XSS, a malicious dependency, or physical device extraction) can call `decryptVaultKeyFromBiometric(encryptedVaultKey, salt, credentialId, userId)` directly and recover the vault key **without ever invoking the biometric**.

**Validation vs. audit:** The audit's "C1 — WebAuthn Verification Dead Code ✅ FIXED" closed a *replay* hole in the ceremony but did not address the deeper problem: there is no server (zero-knowledge local PWA), so client-side WebAuthn assertion checks are advisory, not a boundary. Biometric is currently **UX theater** with respect to the at-rest threat model.

**State-of-the-art fix (May 2026):** Use the **WebAuthn PRF extension** (`prf` / CTAP2 `hmac-secret`). During `navigator.credentials.get()` with a per-user salt, the authenticator returns a deterministic 32-byte secret **only after successful user verification (biometric)**. Feed it through HKDF to derive (or unwrap) the vault key. The secret never exists at rest and cannot be produced without the authenticator. This is exactly how Bitwarden and Dashlane back passkey-unlocked vaults.
- Register: request `extensions: { prf: { eval: { first: salt } } }`; on success store only the salt + a PRF-wrapped copy of the master vault key.
- Unlock: re-evaluate PRF → HKDF → AES-GCM unwrap of the vault key.
- Keep password unlock as the recovery path; treat PRF-unavailable browsers as "biometric convenience only" and **say so in the UI** rather than implying cryptographic protection.

**References:** [Bitwarden — PRF WebAuthn](https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/), [Yubico — Developer's Guide to PRF](https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html), [Corbado — Passkeys & PRF for E2EE (2026)](https://www.corbado.com/blog/passkeys-prf-webauthn)

---

### S2 — 🟠 High: Deployed CSP allows `'unsafe-inline'` and `'unsafe-eval'`

**Location:** [`vercel.json:38`](vercel.json), [`vite.config.ts:175`](vite.config.ts) and `:188`

**Evidence (actual deployed policy):**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
style-src  'self' 'unsafe-inline' https://fonts.googleapis.com;
```
For a password manager, `script-src 'unsafe-inline'` removes the primary defense against XSS-driven vault exfiltration. `'unsafe-eval'` widens it further. There is no `object-src 'none'`, no `base-uri 'self'`, no `frame-ancestors 'none'`, no `form-action 'self'`.

**Validation vs. audit:** `SECURITY_AUDIT_REPORT.md` §M7 claims the CSP is `script-src 'self' 'wasm-unsafe-eval'`. **That policy is not in the codebase.** The audit documents an intended hardened CSP that was never deployed — a reality gap to correct.

**Why `'unsafe-inline'` is currently "needed":** the inline GitHub-Pages SPA redirect script in [`index.html:24-33`](index.html). `'unsafe-eval'` is pulled in by the Tesseract/WASM toolchain.

**State-of-the-art fix:** Static SPAs can't issue a per-request nonce, so use **hash-based CSP with `strict-dynamic`**:
1. Move/keep the inline bootstrap script, compute its SHA-256, and whitelist `'sha256-…'` (a build step already exists: `scripts/inject-sw-version.js`).
2. Replace `'unsafe-inline'` in `script-src` with the hash + `'strict-dynamic'`.
3. Narrow WASM to `'wasm-unsafe-eval'` (drop full `'unsafe-eval'`).
4. For styles, MUI/Emotion injects runtime `<style>`; either adopt Emotion nonce/hash support or keep `style-src 'unsafe-inline'` as a documented, lower-risk residual.
5. Add `object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`.
- Tooling: `vite-plugin-csp-guard` automates hashing for SPA builds.

**References:** [content-security-policy.com — strict-dynamic](https://content-security-policy.com/strict-dynamic/), [Vite CSP Guard — SPA guide](https://vite-csp.tsotne.co.uk/guides/spa), [Google CSP FAQ](https://csp.withgoogle.com/docs/faq.html)

---

### S3 — 🟠 High: CSP `connect-src` blocks HIBP; "no network" claim is stale

**Location:** [`vercel.json:38`](vercel.json) (`connect-src 'self' https://cdn.jsdelivr.net`) vs. [`src/core/breach/hibpService.ts:20-21`](src/core/breach/hibpService.ts) (`api.pwnedpasswords.com`, `haveibeenpwned.com`)

**Evidence:** Breach detection `fetch()`es `https://api.pwnedpasswords.com/range/…` and `https://haveibeenpwned.com/api/v3/…`, neither of which is in `connect-src`. Under the production CSP these requests are **blocked** — the password breach feature silently fails in prod (the failure is swallowed by the catch in `checkPasswordBreach`).

**Validation vs. audit:** §M5 states "Offline-first architecture (no network communication) … No API calls or external data transmission." This is **false as of the breach-detection feature**. The audit predates HIBP integration and must be revised. Even with k-anonymity, the app now makes outbound calls — that belongs in the threat model and privacy disclosure.

**Fix:**
1. Add `https://api.pwnedpasswords.com https://haveibeenpwned.com` to `connect-src` (both `vercel.json` and `vite.config.ts`).
2. Update `SECURITY.md` / audit: document the HIBP egress, the k-anonymity guarantee, and that it is user-toggleable (`VITE_HIBP_API_ENABLED`).
3. Add an explicit "offline / no-egress" mode toggle so privacy-maximalist users can guarantee zero network calls.

---

### S4 — 🟡 Medium: scrypt cost below current OWASP minimum

**Location:** [`src/core/crypto/password.ts:14-19`](src/core/crypto/password.ts) — `N=32768 (2^15)`

**Evidence & research:** The OWASP Password Storage Cheat Sheet (current) states: *"use scrypt with a minimum CPU/memory cost parameter of (2^17), a minimum block size of 8, and a parallelization parameter of 1."* The app uses `2^15`, **4× below** the floor.

**Validation vs. audit:** §M10 marks scrypt "EXCELLENT (5/5)" and "compliant," citing RFC 7914 defaults rather than current OWASP guidance. Understated.

**Fix:** Raise `N` to `2^17` (131072). Add a **versioned hash format** (the PHC-style string already encodes `N`/`r`/`p`) and a transparent rehash-on-login migration so existing users upgrade without a reset. Benchmark on a low-end mobile device to confirm acceptable unlock latency (target < ~750 ms).

**References:** [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

### S5 — 🟡 Medium: Plaintext sensitive metadata at rest

**Location:** [`src/data/storage/database.ts:18-43`](src/data/storage/database.ts)

**Evidence:** `StoredCredential` stores in cleartext: `title`, `username`, `url`, legacy `notes`, `tags`, `category`, and **all card metadata** (`cardholderName`, `expiryMonth`, `expiryYear`, `billingAddress`, `cardType`). Only `encryptedPassword`/`encryptedTotpSecret`/`encryptedNotes`/`encryptedCardNumber`/`encryptedCvv` are encrypted. `dexie-encrypted` is a dependency but **not wired in** — the DB performs no transparent encryption.

**Validation vs. audit:** §M9 calls this "Low, by design (search trade-off)." For a zero-knowledge manager this is **understated**: usernames + site URLs + cardholder name + billing address are exactly the data a vault is meant to protect, and modern managers (Bitwarden) encrypt the URI/username too, deriving an in-memory search index after unlock. An attacker with IndexedDB access today learns *who you are and where you have accounts* without breaking any crypto.

**Fix:** Encrypt all sensitive metadata with the vault key; build the search index **in memory after unlock** (decrypt-then-index). Card billing/cardholder fields should be encrypted unconditionally. Either adopt `dexie-encrypted` properly or extend the existing field-level encryption to cover these columns, with a v5 migration.

---

### S6 — 🟡 Medium: Missing transport/isolation headers; no SRI

**Location:** [`vercel.json:12-41`](vercel.json)

**Evidence:** No `Strict-Transport-Security`, no `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, or `Cross-Origin-Resource-Policy`. Tesseract is loaded from `cdn.jsdelivr.net` with **no Subresource Integrity**.

**Validation vs. audit:** §M7 claims "Subresource Integrity (SRI) for service worker" — there is no SRI anywhere in the tree. Contradicts the audit.

**Fix:**
1. `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
2. `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-origin` (COEP optional; only pursue `crossOriginIsolated` if you later want SharedArrayBuffer — note it complicates the CDN/Tesseract path, so defer).
3. Self-host Tesseract assets (see P2) to make SRI moot and restore offline OCR; otherwise pin SRI hashes.

---

### S7 — 🟡 Medium: Extractable vault keys & key hygiene

**Location:** [`src/data/repositories/UserRepositoryImpl.ts:113-119`](src/data/repositories/UserRepositoryImpl.ts) (`extractable: true`), [`src/core/crypto/encryption.ts:93-103`](src/core/crypto/encryption.ts) (`generateEncryptionKey` extractable)

**Evidence:** The in-memory vault key is imported as extractable. The audit's §M2 frames non-extractability as a *limitation* for export; in fact the current code is the opposite — keys **are** extractable.

**Fix:** Once S1 (PRF) lands, vault keys no longer need to be exported for biometric wrapping → import them **non-extractable**. Keep a separate, password-gated export path (`exportEncryption.ts`) that re-derives from the master password rather than exporting the live `CryptoKey`. `secureWipe()` ([`encryption.ts:229`](src/core/crypto/encryption.ts)) is best-effort only — document that JS cannot guarantee zeroization.

---

### S8 — 🔵 Low: Hardening cleanups

- **Info-leak error strings** — [`encryption.ts:165`](src/core/crypto/encryption.ts) ("invalid key or corrupted data"); collapse to generic "Failed to decrypt." (audit L1, still open).
- **Sensitive `console.*`** — [`password.ts:58,89`](src/core/crypto/password.ts) ("Verifying password…", result), [`UserRepositoryImpl.ts:72`](src/data/repositories/UserRepositoryImpl.ts), `database.ts`. `drop_console: true` strips these in prod, but they leak in dev and contradict the "no sensitive logging" rule in `CLAUDE.md`. Remove at source.
- **`verifyPassword` doesn't use `constantTimeEqual`** — [`password.ts:82-88`](src/core/crypto/password.ts) reimplements comparison inline; route through the existing `constantTimeEqual` helper.
- **Unvalidated import** — [`exportEncryption.ts:82`](src/core/crypto/exportEncryption.ts) and `database.ts:importFromJSON` parse untrusted JSON with no schema check; `zod` is already a dependency — add a schema.
- **Accessibility** — [`index.html:6`](index.html) `maximum-scale=1.0, user-scalable=no` blocks pinch-zoom (WCAG 1.4.4); remove.
- **Rate-limit decay** — [`rateLimiter.ts:38-48`](src/core/auth/rateLimiter.ts) never decays `attempts`; add a reset after the lockout window lapses so a legitimate user isn't permanently escalated.

---

## 3. PWA Architecture Findings

### P1 — Offline resilience gaps
**Location:** [`vite.config.ts:122`](vite.config.ts) (`navigateFallback: null`), `:75-117` (Tesseract via CDN)
- `navigateFallback: null` means offline deep-link navigation (e.g. reload on `/settings`) can fail to serve the app shell. For an installed offline-first SPA, set `navigateFallback: 'index.html'` with a `navigateFallbackDenylist` for asset paths.
- OCR depends on `cdn.jsdelivr.net` — **OCR does not work offline**, contradicting the offline-first promise. Self-host Tesseract core + `eng.traineddata` and precache them (note: 15 MB; gate behind an opt-in download so the base install stays small).

### P2 — Supply chain / runtime CDN dependency
Self-host Tesseract and Google Fonts. This (a) restores offline OCR, (b) lets you drop `cdn.jsdelivr.net` from `script-src`/`connect-src`, (c) eliminates the SRI gap, (d) removes a third-party egress channel from a security-sensitive app.

### P3 — Manifest modernization
[`vite.config.ts:20-55`](vite.config.ts) — add `id`, `display_override: ['standalone','minimal-ui']`, `launch_handler: { client_mode: 'navigate-existing' }`, `shortcuts` (Add credential, Generator, Security audit), `screenshots` (richer install UI), and `categories`. Add maskable verification.

### P4 — Background breach re-checks
The update flow (`registerType: 'prompt'`, manual `skipWaiting`, `UpdateNotification`) is well-designed — keep it. Add **Periodic Background Sync** (where supported) to re-run HIBP checks on a cadence, with graceful fallback to on-unlock checks.

### P5 — Remove dead dependencies
`argon2-browser` (migrated to scrypt — see `DATABASE_MIGRATION.md`) and `dexie-encrypted` (unused) are still in `package.json`. Removing them shrinks the bundle and the dependency attack surface. (`tesseract.js` stays but gets self-hosted per P2.)

---

## 4. Phased Enhancement Roadmap

Mapped to the four mission pillars in `CLAUDE.md`. Each item lists the finding IDs it closes.

### Phase 0 — Correctness & disclosure (this week, ~0.5 day)
*Pillar: Vault Trust Hardening*
1. **Fix CSP `connect-src` for HIBP (S3)** — one-line change in `vercel.json` + `vite.config.ts`; verify breach detection works in a production build. **Highest ROI: a shipped feature is currently broken.**
2. Correct `SECURITY_AUDIT_REPORT.md` §M5/§M7 to match deployed reality (network egress exists; real CSP; no SRI). Truth-in-documentation.
3. Remove sensitive `console.*` and info-leak error strings (S8).

### Phase 1 — Transport & storage hardening (week 1, ~2 days)
*Pillar: Vault Trust Hardening*
4. Add HSTS + COOP/CORP headers (S6).
5. Raise scrypt to `N=2^17` with versioned rehash-on-login migration (S4).
6. Encrypt sensitive metadata; in-memory search index; v5 DB migration (S5).
7. Validate import payloads with `zod`; `constantTimeEqual`; rate-limit decay (S8).
8. Remove `argon2-browser` + `dexie-encrypted` (P5).

### Phase 2 — Strict CSP (week 2, ~2 days)
*Pillar: Threat Intelligence & Reporting*
9. Hash-based CSP with `strict-dynamic`; drop `script-src 'unsafe-inline'`; narrow to `'wasm-unsafe-eval'`; add `object-src/base-uri/frame-ancestors/form-action` (S2). Wire hashing into the existing post-build script or `vite-plugin-csp-guard`.

### Phase 3 — PWA offline & supply chain (week 3, ~2–3 days)
*Pillar: CredOps Experience*
10. Self-host Tesseract + fonts; precache with opt-in OCR download (P1, P2); enables dropping the CDN from CSP.
11. `navigateFallback: 'index.html'` + denylist (P1).
12. Manifest modernization (P3).

### Phase 4 — Passwordless done right (week 4–5, ~4–5 days)
*Pillar: Passwordless & Recovery*
13. **WebAuthn PRF-backed vault unlock (S1)** — the headline change. Register/unlock via PRF→HKDF; non-extractable keys (S7); password remains the recovery path; UI honestly states the security level when PRF is unavailable.
14. Recovery codes generated at signup (closes the audit's open "account recovery" recommendation).

### Phase 5 — Verification (ongoing)
15. Background-sync breach re-checks (P4).
16. Per Definition-of-Done: `npm run type-check && lint && test`, record in `TEST_STATUS.md`, refresh `SECURITY_AUDIT_REPORT.md`. Add a CSP/headers integration test and a "no plaintext secrets in IndexedDB" test to prevent regressions.

---

## 5. Quick-Win Priority Order

1. **S3** — unbreak HIBP under CSP (minutes).
2. **S2** — strict CSP (biggest XSS risk reduction for a vault).
3. **S1** — WebAuthn PRF (biggest *architectural* integrity gain).
4. **S5 / S4** — close the at-rest exposure and KDF gap.

---

## 6. References (May 2026)

- OWASP Password Storage Cheat Sheet — scrypt `N≥2^17`: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Bitwarden — PRF WebAuthn & passkeys: https://bitwarden.com/blog/prf-webauthn-and-its-role-in-passkeys/
- Yubico — Developer's Guide to PRF: https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html
- Corbado — Passkeys & WebAuthn PRF for E2EE (2026): https://www.corbado.com/blog/passkeys-prf-webauthn
- content-security-policy.com — `strict-dynamic`: https://content-security-policy.com/strict-dynamic/
- Vite CSP Guard — SPA hashing guide: https://vite-csp.tsotne.co.uk/guides/spa
- Google CSP FAQ: https://csp.withgoogle.com/docs/faq.html

---

---

## 7. Pre-existing issues found during implementation

- **TOCTOU race in `UserRepositoryImpl.createUser` (real bug).** `createUser` does `findByEmail()` then `db.users.add()` with no atomic guard, so two concurrent signups with the same email can both succeed. The test `should handle concurrent user creation with same email` fails on the **original** source (verified by stashing all of this change set), so it is not a regression. Fix: enforce uniqueness at the Dexie schema level (`&email`) or wrap the check+add in a transaction. Recommended as a fast follow.
- The repo's `npm run lint` (`--max-warnings 0`) was already red before these changes (`any`, `no-console`, `unbound-method`, `no-non-null-assertion` debt across several files). The files added in this change set are lint-clean; repo-wide lint cleanup is tracked separately.

---

*Generated by deep review of the TrustVault graph + source + project audit, grounded to May 2026 best practices.*
