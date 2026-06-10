# PWA Offline Suite (P1/P3/P4) — Design

**Date:** 2026-06-10
**Status:** Approved (Ian, 2026-06-10)
**Closes:** `SECURITY_PWA_ENHANCEMENT_PLAN.md` §0 — the last pending row (P1/P3/P4)
**Approach:** Three sequential phases, each independently validated and shippable (mirrors the A–E hardening plan structure).

---

## Context

The security hardening plan (2026-06-10, phases A–E) closed S2/S7/S8/P2/P5. The
only formally tracked pending featureset is the PWA offline suite:

- **P1 (remainder):** `navigateFallback: null` in `vite.config.ts` breaks
  offline deep-link reloads (e.g. reload on `/settings` while offline fails to
  serve the app shell). The OCR-offline half of P1 was already fixed by P2
  (self-hosted Tesseract assets).
- **P3:** Manifest lacks `id`, `display_override`, `launch_handler`,
  `shortcuts`, `screenshots`, `categories`.
- **P4:** No background HIBP breach re-checks. Constraint discovered during
  design: `checkPasswordBreach` (`src/core/breach/hibpService.ts:110`) needs
  the plaintext password to compute its SHA-1; the vault is locked during
  background sync, so a true background *password* check is impossible without
  persisting something outside the vault.

**Decisions (Ian, 2026-06-10):**
- Full P4 scope: Periodic Background Sync where supported + on-unlock fallback everywhere.
- P4 mechanism: **prefix prefetch** — persist each credential's 5-char SHA-1
  prefix (the exact string already disclosed to HIBP by design; ~1M passwords
  share each prefix, near-zero leak). Background sync prefetches range
  responses; comparison happens on unlock, instantly and offline.
- P3 screenshots: capture real ones via Playwright against the production preview.
- Orphaned `public/sw-custom.js` (never registered) is left as-is; only the
  new periodic-sync script gets wired via workbox `importScripts`.

---

## Phase 1 — Offline navigation (P1 remainder)

**Change:** `vite.config.ts` workbox config:
- `navigateFallback: 'index.html'` (resolved against `BASE_PATH` —
  `/TrustVault-PWA/index.html` on GH Pages, `/index.html` on Vercel).
- `navigateFallbackDenylist: [/^\/api\//, /\/ocr\//, /\.[a-z0-9]+$/i]` so
  asset and OCR requests never receive the app shell.

**Validation:** `npm run build && npm run preview`; DevTools offline mode;
hard-reload on `/settings` deep link → app shell loads. Existing suites green.

**Rollback:** single revert; no data impact.

---

## Phase 2 — Manifest modernization (P3)

**Change:** `VitePWA` manifest block in `vite.config.ts`:
- `id: BASE_PATH`
- `display_override: ['standalone', 'minimal-ui']`
- `launch_handler: { client_mode: 'navigate-existing' }`
- `categories: ['security', 'productivity', 'utilities']`
- `shortcuts`: Add Credential → `/credentials/add`, Password Generator →
  `/password-generator`, Security Audit → `/security-audit` (verified against
  `App.tsx` routes; each using the existing 192px icon; URLs resolved against
  `BASE_PATH`).
- `screenshots`: two real captures saved to `public/screenshots/` —
  wide 1280×720 (dashboard), narrow 750×1334 (password generator) — captured
  via Playwright against the production preview with a demo vault.

**Validation:** `npm run build`; Lighthouse PWA audit stays 100/installable;
Chrome DevTools → Application → Manifest shows no warnings; richer install
prompt renders.

**Rollback:** single revert; no data impact.

---

## Phase 3 — Background breach re-checks (P4)

### 3a. Prefix store
- New Dexie table `breachPrefixes` (**v8 migration**):
  `{ credentialId, sha1Prefix (5 hex chars), updatedAt }`.
- Written whenever a credential's password is created or changed (hooked into
  `CredentialRepositoryImpl.create/update`); row deleted when the credential is
  deleted.
- **ZK rationale:** the prefix is exactly the string already sent to HIBP under
  k-anonymity — persisting it adds no new disclosure. Documented as a residual
  in `SECURITY.md`.

### 3b. Service-worker periodic sync
- New `public/sw-periodic-sync.js`, wired via workbox `importScripts` (the SW
  is built in `generateSW` mode, so listeners must come from an imported script).
- On `periodicsync` event (tag `hibp-refresh`, `minInterval` 7 days): read
  prefixes from IndexedDB, fetch `range/{prefix}` from
  `api.pwnedpasswords.com` honoring the existing rate-limit etiquette, store
  responses in a dedicated Cache Storage bucket `hibp-ranges` (7-day expiry).
- Registration is feature-detected (Chromium + installed PWA + permission);
  silently absent elsewhere.

### 3c. On-unlock fallback (all browsers)
- After unlock, if the last full check is older than 7 days: run
  `checkPasswordBreach` per credential, consulting the `hibp-ranges` cache
  first (instant + offline when prefetched), falling back to network.
- Results surface through the existing Security Audit dashboard; only new UI is
  a "last checked" timestamp.

**Validation (strictest gate — touches storage + SW):**
- Unit tests: prefix persistence + cleanup, v8 migration, staleness logic,
  cache-first range lookup.
- `npm run type-check && npm run lint && npm run test` all green.
- Manual drill: install PWA → trigger periodic sync via DevTools → verify
  `hibp-ranges` populated → unlock → confirm instant breach results offline.
- Record in `TEST_STATUS.md` and `SECURITY_AUDIT_REPORT.md`.

**Rollback:** v8 migration is additive (new table only); revert removes the
sync registration and table writes; existing data unaffected.

---

## Doc touchpoints (every phase)

`SECURITY_PWA_ENHANCEMENT_PLAN.md` §0 status table (P1/P3/P4 → Done),
`ROADMAP.md`, `SECURITY.md` (prefix-store residual), `CLAUDE.md`,
`graphify update .` after code changes.

## Out of scope

- Fixing/wiring the orphaned `public/sw-custom.js`.
- Account recovery codes (separate spec).
- TOTP backup codes.
- Test-coverage push to >85% (tracked separately in ROADMAP).
