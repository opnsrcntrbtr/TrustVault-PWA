# TDD Improvement Plan — Presentation Components & Pages (v4, reviewed + Bitwarden-benchmarked)

**Date:** 2026-08-02
**Status:** Planned (awaiting approval; execution happens in later sessions, one workstream at a time)
**Program type:** Mixed — targeted refactoring + exhaustive component/page coverage + documented feature gaps + E2E (Playwright) + test-suite debt cleanup + Bitwarden-benchmarked feature workstreams, every change driven by Test-Driven Development (red → green → refactor)
**Target areas:** `src/presentation/pages/**`, `src/presentation/components/**`, `src/presentation/hooks/**`, `src/features/**` (CSV, audit, trash, history, reprompt, generator-history), `src/domain/entities/**`, `src/data/storage/**` (schema v11), `e2e/**`
**Revision:** v4 (2026-08-02) — adversarial review applied (verified against project state + Testing Trophy / Testing Library / Playwright docs) **and Bitwarden state-of-the-art benchmark applied** (patterns only; license guardrail in §7). **Coverage model: exhaustive** (owner decision). **Dependency policy: `axe-core` + `papaparse` approved.**

---

## 1. Context & Baseline (verified 2026-08-02)

TrustVault PWA is feature-complete (7 phases + AI; **1414/1415 tests passing** per `docs/testing/TEST_STATUS.md`). This plan targets the **presentation layer** and its supporting E2E/test hygiene, plus five Bitwarden-parity feature workstreams (WS-J…WS-N) that were researched and added at v4.

**Verified inventory (shell counts, Node v22.23.1):**
- **Components:** 45 (`src/presentation/components/`: 41 + `ai/`: 4). Tested: **12** → **33 untested** (all targeted by WS-C). *New components introduced by WS-J…N are covered test-first inside their own workstreams and roll into the exhaustive inventory on landing.*
- **Pages:** 12 (README.md is not a page). Direct tests: 2 (`PasswordGeneratorPage`, `UnlockPage`).
- **Test files:** 115 colocated `*.test.ts(x)` under `src/`.
- **E2E:** 1 smoke spec (`e2e/login.spec.ts`), Playwright config present (`baseURL: http://localhost:3000/TrustVault-PWA`).
- **Database:** `TrustVaultDB` at **schema v10** (Dexie). Encrypted sensitive fields follow the `encrypted*` prefix pattern (`encryptedBackupCodes` is the model for the new encrypted password-history blob). Post-login backfill pattern (v5 metadata seal, v10 profile backfill) is the precedent for vault-key-dependent migrations.
- **Lint baseline:** documented ~853–855 problems across TEST_STATUS snapshots; **must be re-measured at execution time**.

### 1.1 Pages — direct test status

| Page | Direct tests | Integration coverage | Plan |
|---|---|---|---|
| `PasswordGeneratorPage.tsx` | ✅ 5/5 | ✅ | Baseline; + WS-M generator history |
| `UnlockPage.tsx` | ✅ | ✅ | Baseline; no new work |
| `DashboardPage.tsx` | ❌ | ✅ `credential-crud`, `dashboard-sort` | WS-D (+ WS-A score dedupe) |
| `FavoritesPage.tsx` | ❌ | ❌ | WS-D |
| `CredentialDetailPage.tsx` | ❌ | ❌ | WS-D, WS-H, WS-J (restore/trash), WS-K (history), WS-L (re-prompt) |
| `AddCredentialPage.tsx` | ❌ | ✅ `credential-crud` | WS-B (610-line monolith), WS-L (re-prompt toggle) |
| `EditCredentialPage.tsx` | ❌ | ❌ | WS-B (733-line monolith), WS-L (re-prompt toggle) |
| `SecurityAuditPage.tsx` | ❌ | ❌ (manual only) | WS-A (engine inline), WS-N (2 new report types) |
| `SettingsPage.tsx` | ❌ | ✅ `master-password-change`, `import-export` | WS-D (dialog-gating area) |
| `LoginPage` / `SigninPage` / `SignupPage` | ❌ | ✅ `auth-flow` | WS-D |

### 1.2 Components — test status (33 untested → WS-C)

**Tested (12):** `AiAssistanceSettings`, `BackupCodeInput`, `BackupCodesModal`, `BreachDetailsModal`, `ErrorBoundary`, `OcrOverlaySettings`, `PasswordStrengthIndicator`, `SortDropdown`, `ai/BreachInsightCard`, `ai/ChatPanel`, `ai/GeneralAssistant`, `ai/StrengthInsightCard`.

**Untested (33):**
- **Credential display & interaction:** `CredentialCard`, `CredentialSection`, `CredentialDetailsDialog`, `SwipeableCredentialCard`, `TotpDisplay`, `CategoryIcon`
- **Dialogs & modals:** `DeleteConfirmDialog`, `ExportDialog`*, `ImportDialog`*, `PasswordGeneratorDialog`, `ChangeMasterPasswordDialog`, `BiometricSetupDialog`, `CameraScanDialog`, `OcrResultDialog`, `UnlockDialog`
- **Search / filter / input:** `SearchBar`, `FilterChips`, `TagInput`
- **Settings controls:** `AutoLockSettings`, `ClipboardSettings`, `ClipboardNotification`, `ProfilesSettings`, `ProfileSwitcher`, `ThemeToggle`
- **PWA / chrome / utility:** `OfflineIndicator`, `MobileNavigation`, `InstallPrompt`, `UpdateAvailableSnackbar`, `UpdateNotification`, `ReEncryptionProgress`, `BreachAlertBanner`, `CryptoAPIError`, `RouteErrorBoundary`
- **Onboarding / help:** `OnboardingTour`, `TourHelpButton`

\* Integration-covered (`import-export.test.tsx`) but no direct unit tests.

### 1.3 Hooks, stores, utils — baseline

All 8 hooks, all 5 stores, all 5 utils have tests. New hooks introduced by WS-B/WS-K/WS-L/WS-M get their own tests as part of those workstreams.

### 1.4 Documented gaps in scope

| Gap | Source | Workstream |
|---|---|---|
| CSV import/export | ROADMAP; GAP_ANALYSIS §17 #6 | WS-E |
| Credential history view (read-only last-accessed) | GAP_ANALYSIS §12/#12 | WS-H |
| WCAG 2.1 AA audit | GAP_ANALYSIS §17 #9 | WS-H |
| TOTP SMS fallback (stub) | GAP_ANALYSIS §17 #5 | WS-H (deferred, flagged) |
| E2E = 1 smoke spec | GAP_ANALYSIS §13 | WS-F |
| 13 lint errors in test files; 1 flake; timer flakiness | ROADMAP; TEST_STATUS | WS-G |
| **No trash/recovery (hard delete only)** | GAP_ANALYSIS ("No trash/recovery"); Bitwarden benchmark | **WS-J (new)** |
| **Password history + restore (only `lastAccessedAt` tracked)** | GAP_ANALYSIS §12; Bitwarden benchmark | **WS-K (new)** |
| **No per-item master-password re-prompt** | Bitwarden benchmark | **WS-L (new)** |
| **No generator history** | Bitwarden benchmark | **WS-M (new)** |
| **Audit missing unsecured-websites + inactive-2FA reports** | Bitwarden benchmark | **WS-N (new)** |

### 1.5 Coverage targets

`vitest.config.ts` enforces lines ≥85 / functions ≥85 / branches ≥80 / statements ≥85. `TESTING_PATTERNS.md`: components ≥70%. **Owner decision: exhaustive direct coverage of all 33 components + 10 pages is in scope** — tests must be *behavior-focused* (user-observable) so exhaustiveness does not produce brittle "coverage theater" (see §3).

### 1.6 Bitwarden state-of-the-art benchmark (v4 — patterns only)

Deep research over `github.com/orgs/bitwarden/repositories` (68 repos: `bitwarden/clients` = Angular web/browser/desktop/CLI, **GPL-3.0**; `server` C#; `sdk` Rust) surfaced the following parity opportunities. **License guardrail:** TrustVault is **Apache-2.0**; Bitwarden's flagship clients are **GPL-3.0**. Only *UX/product patterns and architecture shapes* are adopted — never GPL code, files, or structures. Guardrail details in §7.

| Bitwarden pattern (verified) | TrustVault current state | Plan action |
|---|---|---|
| **Trash / soft-delete + restore** (30-day retention, permanent delete from Trash) | Hard delete only | **WS-J** — `deletedAt` flag, Trash page, restore, retention purge |
| **Password history** (last 5, timestamps) + **restore previous password** | Only `lastAccessedAt` tracked | **WS-K** — encrypted history blob (v11), history UI, restore |
| **Master-password re-prompt** on sensitive items | Not present | **WS-L** — per-credential flag + re-prompt dialog using existing `verifyPassword` |
| **Generator history** (session-scoped, cleared on lock/logout) | Generator exists, no history | **WS-M** — in-memory history, wipe on `lockVault` |
| **Security reports**: weak ✓ / reused ✓ / exposed ✓ + **unsecured-websites** (`http://`) + **inactive-2FA** (2FA-capable domain w/o TOTP) | Engine has weak/reused/old/breached | **WS-N** — 2 new issue types in `securityAuditEngine` (WS-A) |
| **View/edit modes + copy→toast + clipboard auto-clear** | Clipboard auto-clear ✓ | Already aligned (WS-D/WS-H) |
| **Import/export w/ field mapping** | `.tvault` ✓, CSV planned | Already aligned (WS-E) |
| **E2E**: API-driven state setup, `storageState`, isolated contexts | Plan's WS-F already uses these | Already aligned |

Not adopted (out of scope for an offline-first single-device PWA): server-side sync, cloud key rotation, organizations, collections.

---

## 2. Goals & Non-Goals

### Goals
1. Move security-critical, business logic **out of components into pure, unit-tested modules** (testable without DOM/jsdom).
2. **Exhaustive direct test coverage** of every presentation component (33) and page (10) — behavior-focused, per §3 conventions.
3. Ship documented **CSV import/export** (via `papaparse`) **with CSV-injection protection**, tests first.
4. Ship the **credential history view** and a **WCAG 2.1 AA audit** (axe-core-assisted, TDD for testable fixes).
5. Grow **Playwright E2E** from 1 smoke spec to critical-journey coverage (web-first assertions, isolated state, `storageState`, `page.route`, `context.setOffline`).
6. **Zero test-suite debt**: fix the 13 lint errors in test files, the known flake, and timer nondeterminism; final full-suite target **1415/1415**.
7. Adopt **verified testing best practices**: RTL `user-event` over `fireEvent`; web-first assertions in E2E; static analysis as base layer.
8. **Trash / soft-delete + restore** (WS-J): soft-delete, Trash surface, restore, permanent delete, retention purge — Bitwarden-parity recovery UX, TDD-first.
9. **Password history + restore** (WS-K): encrypted, capped history per credential with restore-previous-password — TDD-first.
10. **Per-item master-password re-prompt** (WS-L): reuses existing `verifyPassword`; sensitive fields gated — TDD-first.
11. **Generator history** (WS-M): session-scoped, wiped on lock/logout — TDD-first.
12. **Audit report parity** (WS-N): unsecured-websites + inactive-2FA issue types in the WS-A engine — TDD-first.

### Non-Goals
- No changes to crypto/auth/breach **core** modules (≥90% covered) — *except* reading `verifyPassword` for WS-L (existing API, no modification).
- No full rewrite of pages — decomposition only where it enables testing or removes duplication.
- New deps are **approved and enumerated**: runtime `papaparse` (+ `@types/papaparse` dev); dev `axe-core`. No other new dependencies without explicit approval. The 2FA-support dataset (WS-N) is **bundled static data**, not a runtime dependency.
- **No Bitwarden GPL code**: patterns/UX only; no file copies, no code translation, no NOTICE implications (Apache-2.0 stays clean). Guardrail in §7.
- **No cloud sync / multi-device / server** (Bitwarden's server is GPL + requires a backend; TrustVault is offline-first).
- Not fixing the entire repo-wide lint baseline in one pass; WS-G targets test files and guarantees **0 new** issues per touched file.
- WebAuthn/biometric E2E stays in the **manual** suite (physical authenticator required).

---

## 3. TDD Workflow & Conventions (v3 — best-practice aligned)

Every task follows red → green → refactor, recorded in `docs/testing/TEST_STATUS.md` per AGENTS.md.

1. **RED** — failing test(s) in a colocated `__tests__/` file (`src/presentation/**/__tests__/*.test.ts(x)`). Confirm failure is for the right reason (`npx vitest run <file>`).
2. **GREEN** — minimal production code to pass.
3. **REFACTOR** — rewire the component/page to consume the new module; re-run → still green.
4. **VALIDATE** — §6 gates; record evidence in TEST_STATUS.

**Conventions (updated from verified sources — Testing Library, Playwright docs):**
- **`user-event` over `fireEvent`** for all interactions (`@testing-library/user-event` already in devDependencies). Reserve `fireEvent` only where user-event lacks support (e.g. synthetic swipe).
- **Test behavior, not implementation**: interact with the rendered UI (role/text queries), assert user-observable outcomes (rendered text, callbacks fired, DOM state). No assertions on internal component state, prop plumbing, or lifecycle details.
- **Async**: prefer `findBy*`/`waitFor` over fixed sleeps; timers via `vi.useFakeTimers()`.
- **E2E**: web-first assertions (`await expect(locator).toBeVisible()`), never manual `waitForTimeout`; isolated browser contexts; unique user per spec; `storageState` for auth bootstrap; `page.route` for HIBP; `context.setOffline(true)` for offline.
- **Prerequisite**: run `npm install` before any gate (workspace ships without `node_modules`; the preview install command covers this).
- Fixtures from `src/__tests__/fixtures/`; `@/` aliases; no `console.log`; **never log secrets** (incl. password columns in CSV errors and password-history entries).
- **DB migrations**: additive Dexie `version(11)` for WS-J/K/L; vault-key-dependent writes (encrypted history, encrypted trash-title state if ever needed) follow the post-login backfill pattern (v5/v10 precedent). Migration logic itself is pure where possible and unit-tested; the `.upgrade()` body stays thin.

---

## 4. Workstreams & Tasks

> Order = value/risk. Independent workstreams; finish one task (incl. validation) before starting the next. WS-A/B/E are prerequisites to their downstream rewiring; WS-N depends on WS-A; WS-K/L wire into pages that WS-D/WS-H already cover.

### WS-A — Extract & test Security Audit logic (highest value)

**A1 — Pure module `securityAuditEngine` (TDD, no DOM)**
- New: `src/presentation/pages/securityAuditEngine.ts`. Exports: `buildSecurityIssues(credentials, breachedCredentials, opts?) → SecurityIssue[]`, `computeSecurityScore(credentials) → number`, `countIssuesByType(issues)`, `formatAgeDays(updatedAt, now)`, plus the `SecurityIssue` **type** (exported for reuse).
- Port rules exactly from `analyzeCredentials()` (breach-priority; missing-password; weak `<60`/`<40` bands; reused via password map; old `>365`/`>730`; plain-avg score). Pure & synchronous — breach data is *pre-loaded* by the caller.
- Tests: each issue type fires; band boundaries (39/40, 59/60); breach outranks weak; reused aggregation + single issue; empty vault → score 0/no issues; age boundaries (365/366, 730/731); zeroed `issuesByType` shape; deterministic ids.
- **Dedupe (review finding):** `DashboardPage` computes the same plain-avg score inline — rewire it to consume `computeSecurityScore` too (kills the duplicated logic).
- **Extension point for WS-N:** issue types are a closed union today; WS-N adds `unsecured_website` and `inactive_2fa` members + rules in this module (not in the page).

**A2 — Score/label helpers (TDD):** extract `getScoreColor`, `getScoreLabel`, `getSeverityColor`, `getSeverityIcon` (mappings pure; icon JSX stays in page). Tests: label/color boundaries (80/60/40); all five severities + unknown fallback.

**Acceptance:** A1–A2 green; `SecurityAuditPage` **and** `DashboardPage` consume the module with identical output; no new lint.

### WS-B — Decompose Add/Edit credential monoliths

**B1 — Pure validation (TDD):** `src/presentation/pages/credentialFormValidation.ts` — `validateCredentialForm(input) → { valid, errors: { title?, username?, password?, url?, category? } }` (URL via `url.ts`, password min 12 parity with signup, tag cap). Tests: per-field rules, valid form, boundaries (11/12 chars, empty title, bad URL, tag cap), errors only for failing fields.
**B2 — Shared `useCredentialForm` hook (TDD):** `src/presentation/hooks/useCredentialForm.ts` — state, handlers, validate-on-submit, dirty tracking, edit-mode seeding, reset, and (after WS-L) the `requiresMasterPasswordReprompt` toggle field. Tests (`renderHook`): seed, immutable edits, `onSave` only-when-valid, errors clear on fix, dirty toggles, reset.
**Refactor:** both pages consume B1+B2 (removes the largest duplicated chunk of the 610/733-line files).

**Acceptance:** B1–B2 green; `credential-crud.test.tsx` passes; pages shrink, behavior unchanged.

### WS-C — Exhaustive direct coverage of all 33 untested components

Colocate under `src/presentation/components/__tests__/`; mock stores/services (never real crypto/DB/IndexedDB). **Behavior-focused**: assert what users see/do (rendered fields, fired callbacks, disabled states), via `user-event`.

**C1 — Credential display & interaction**
| Component | Minimum behavior cases |
|---|---|
| `CredentialCard` | title/username/breach badge render; menu actions (edit/favorite/delete) fire callbacks; empty credential renders without crash; loading state |
| `CredentialSection` | groups credentials by category; renders items; empty state |
| `CredentialDetailsDialog` | renders all fields (password masked); copy buttons fire handlers; favorite toggle; close; breached alert passthrough |
| `SwipeableCredentialCard` | swipe reveals actions (mock `useSwipeGesture`); tap resolves; actions fire callbacks |
| `TotpDisplay` | 6-digit code renders; seconds-left formatting (fake timers); window rollover; error/empty states |
| `CategoryIcon` | icon per category; unknown fallback; accessible label |

**C2 — Dialogs & modals**
| Component | Minimum behavior cases |
|---|---|
| `DeleteConfirmDialog` | confirm/cancel fire; loading disables confirm; credential title shown; Escape closes |
| `ExportDialog` | format options (`.tvault` + CSV after WS-E); password validation (min 12); strength shown; success/failure feedback |
| `ImportDialog` | file selection; wrong-password error; merge/replace modes; progress; success summary |
| `PasswordGeneratorDialog` | renders password; regenerate; copy; insert callback; **(post WS-M)** history list + reuse |
| `ChangeMasterPasswordDialog` | current/new/confirm validation; mismatch error; strength meter; submit only-when-valid |
| `BiometricSetupDialog` | device-support gating; enrollment states; failure + retry; close |
| `CameraScanDialog` | permission denial; capture → OCR handler; cancel |
| `OcrResultDialog` | parsed fields shown; edit/confirm/discard actions |
| `UnlockDialog` | password unlock; biometric button calls handler; error + loading states |

**C3 — Search / filter / input**
| Component | Minimum behavior cases |
|---|---|
| `SearchBar` | debounced `onChange` (fake timers); clear button; controlled value |
| `FilterChips` | active-chip highlight; category callback; "All" reset; disabled state |
| `TagInput` | add on Enter; comma add; duplicate rejection; remove; empty no-op |

**C4 — Settings controls**
| Component | Minimum behavior cases |
|---|---|
| `AutoLockSettings` | options render; change persists to store; disabled while saving |
| `ClipboardSettings` | options render; save handler; parity with `clipboard.ts` defaults |
| `ClipboardNotification` | shows on clipboard event; auto-hide (fake timers); dismiss |
| `ProfilesSettings` | list; create/rename/delete callbacks; active highlight |
| `ProfileSwitcher` | list; selection calls store; active check |
| `ThemeToggle` | toggles `themeStore`; icon reflects mode |

**C5 — PWA / chrome / utility**
| Component | Minimum behavior cases |
|---|---|
| `OfflineIndicator` | renders offline (`navigator.onLine` mock), hidden online |
| `MobileNavigation` | nav items; active highlight; logout action |
| `InstallPrompt` | hidden when criteria unmet; captures `beforeinstallprompt`; install click fires prompt |
| `UpdateAvailableSnackbar` | renders on `updateavailable`; reload action; dismiss |
| `UpdateNotification` | pending render; skip-waiting handshake |
| `ReEncryptionProgress` | progress %; completion callback; cancellation |
| `BreachAlertBanner` | renders when breached > 0; CTA to audit (mock router); dismiss |
| `CryptoAPIError` | guidance render; retry callback |
| `RouteErrorBoundary` | catches child error → fallback + retry (template: `ErrorBoundary.test.tsx`) |

**C6 — Onboarding / help**
| Component | Minimum behavior cases |
|---|---|
| `OnboardingTour` | renders steps; completion persists (mock `useDriverTour`); skip |
| `TourHelpButton` | opens tour when enabled; aria-label |

**Acceptance:** 33 new colocated test files, all green, `user-event`-based, behavior-focused, no new lint.

### WS-D — Page-level behavior tests (all 10 untested pages)

Mount with mocked stores/repos/router; assert behavior + error states (complements, not duplicates, integration happy paths):

- `DashboardPage`: stats from mocked list (avg score, counts); search filters; category filter; empty state; lock button calls store.
- `FavoritesPage`: favorites only; empty state; unfavorite removes.
- `CredentialDetailPage`: loading → rendered; missing → error + back; edit navigates; delete confirm path calls repo → navigates; favorite toggle updates UI. *(Post WS-J/K/L: restore/trash actions, history list, re-prompt gate.)*
- `SecurityAuditPage` (post WS-A/WS-N): renders score + issues from mocked engine; scan button triggers `scanForBreaches`; disabled while scanning.
- `SettingsPage`: sections render; dialog open/close gating for Change Password / Export / Import (pins the historic jsdom mis-click regression); no `setTimeout(navigate)` side effects.
- `AddCredentialPage` / `EditCredentialPage` (post WS-B): mount with mocked `useCredentialForm`; save/cancel wiring; edit pre-fill; re-prompt toggle.
- `LoginPage` / `SigninPage` / `SignupPage`: validation messages (email, 12-char password, mismatch); submit fires auth handler; biometric button gated on availability; error display.

**Acceptance:** all green; no `.skip`; `src/__tests__/integration/` still green.

### WS-E — CSV import/export with injection protection (TDD, papaparse)

- **E1 — Export:** `src/features/vault/csv/csvExport.ts` — `serializeCredentialsCsv(credentials) → string` (header row, RFC 4180 quoting, tags/category encoding, UTF-8 BOM option). **CSV-injection guard applied on import path, not export.**
- **E2 — Import:** `src/features/vault/csv/csvImport.ts` — `parseCredentialsCsv(text) → { rows, errors }` **built on `papaparse`** (battle-tested parser; no hand-rolled RFC 4180 edge cases). Wraps it with: header detection/variants; per-row validation (parity with Zod import caps: row count, field length, enum checks); **CSV-injection sanitization** — fields starting with `=`, `+`, `-`, `@` are prefixed/quoted-neutralized before use; **never echoes password content** into errors or logs.
- Tests: round-trip export→parse; quoting (commas, quotes, newlines, UTF-8); header variants; malformed row → indexed error; empty input; injection payloads (`=HYPERLINK(...)`, `+cmd`, `-cmd`, `@cmd`) are neutralized; caps enforced; password column absent from error messages.
- Wire (after E1/E2 green): "CSV" format option in `ExportDialog` (Blob download); "CSV" accept in `ImportDialog` (parse → credential inputs → existing validation).
- **Deps (approved):** `papaparse` (runtime) + `@types/papaparse` (dev).

**Acceptance:** E1/E2 fully unit-tested before wiring; injection tests green; dialogs' integration tests pass; manual export→import round trip recorded.

### WS-F — E2E: grow from smoke to critical journeys (Playwright best practices)

- **F1 — Infrastructure & isolation:** `e2e/fixtures/` helpers — unique user per spec; clear IndexedDB in `beforeEach`; **auth bootstrap via `storageState`** (one signup → save state → reuse for CRUD/security/audit specs, keeping the suite fast); verify existing `login.spec.ts` green on Chromium + CI WebKit.
- **F2 — Auth journey:** signup → vault setup → lock → unlock (master password) → logout → login; assert URL transitions + lock gating. *(No `storageState` shortcut here — this journey is the feature under test.)*
- **F3 — Credential CRUD:** add (with generator), edit, favorite toggle, search filter, detail view, delete; assert persistence across navigation.
- **F4 — Security flows:** auto-lock (short timeout); change master password → re-login; export `.tvault` → import (merge); backup-code reveal.
- **F5 — PWA/offline drill:** `context.setOffline(true)` → reload → unlock → dashboard renders from IndexedDB; `OfflineIndicator` visible; restore online.
- **F6 — Security Audit:** seed weak-password credential; run "Scan All"; assert issue list + lower score. HIBP endpoint mocked via `page.route`.
- **F7 — A11y focus journeys (cross-link from WS-H):** dialogs open → focus moves into dialog; Escape closes and focus returns to trigger — asserted in real browser where jsdom cannot.
- **F8 — Cross-browser:** CI matrix Chromium + WebKit; documented skips (WebAuthn — manual only).
- **F9 — Trash lifecycle (post WS-J):** soft-delete → item leaves dashboard → appears in Trash → restore → reappears → delete again → permanent delete; assert retention messaging.
- **F10 — Re-prompt journey (post WS-L):** credential flagged re-prompt → open detail → master-password prompt → wrong password blocked → correct password reveals → cancel keeps it masked.

**Acceptance:** `npm run e2e` green (Chromium locally); web-first assertions only; deterministic (isolated state per spec); each spec maps to a documented user journey.

### WS-G — Test-suite debt cleanup

- **G1 — Fix 13 ESLint errors in test files** (non-null assertions, deprecated fields): targeted eslint per file; no production-code changes. **Re-measure the full baseline first** (`npm run lint`) to record the true starting number.
- **G2 — Fix the known flake:** `import-export.test.tsx` "reject import with wrong password" → deterministic (explicit await, fake timers or stronger bound); green in isolation **and** full suite.
- **G3 — Timer determinism audit:** TOTP, clipboard, `useAutoLock` suites — all timer paths via `vi.useFakeTimers()`; no real `setTimeout` waits.
- **G4 — Lint gate:** `npm run lint` must not exceed baseline at any commit; touched files **0 new**; baseline deltas tracked in TEST_STATUS.
- **G5 — Evidence:** TEST_STATUS per-fix results (isolated + full-suite).

**Acceptance:** lint baseline reduced (≥13 fewer) with zero new; full suite 1415/1415 at program end.

### WS-H — Documented feature gaps (credential history + a11y)

- **H1 — Credential history view (TDD):** `lastAccessedAt` already tracked. Pure helper (`timeFormat.ts` extension): `formatLastAccessed(cred, now)` — tests: today/yesterday/N-days/months; never-accessed; undefined guards. Component: metadata rows in `CredentialDetailPage`/`CredentialDetailsDialog` (Created/Updated/Last accessed); hidden for missing values. *(WS-K later adds the actual password-change history beside these rows.)*
- **H2 — WCAG 2.1 AA audit (axe-core-assisted):**
  - Add `axe-core` (dev, approved). Small helper `src/test/setup.ts` → `runAxe(container)` returning violations; used in component tests for the **core dialogs + forms** (assert zero violations of configured rules).
  - Fix findings assertable in jsdom first: dialog focus management (focus moves to dialog on open — structural assertions + WS-F F7 for real focus), aria-labels/roles on icon-only buttons, contrast-safe severity colors, Escape-to-close.
  - Manual audit against `docs/security/audit-checklist.md`; record results there.
- **H3 — TOTP SMS fallback:** keep **deferred** (flagged, documented for traceability; no backend exists).

**Acceptance:** H1 shipped with tests; H2 has axe-driven tests on core dialogs + recorded manual audit; H3 explicitly deferred.

### WS-I — Cross-cutting quality (every touched file)

- No `console.log`/`debugger`; **0 new** ESLint problems per touched file.
- `user-event` for interactions; `vi.useFakeTimers()` for time; `findBy*`/`waitFor` for async.
- Deterministic: no network, no real IndexedDB in component tests.
- TEST_STATUS evidence per task (tests, verification, lint deltas) + link to this plan.

### WS-J — Trash / soft-delete + restore (NEW, Bitwarden-parity)

> Precedent: Bitwarden moves deleted items to Trash, retains 30 days, supports restore and permanent delete. TrustVault currently hard-deletes (`DeleteConfirmDialog` → repo delete). Soft-delete is a UX **and** data-safety improvement.

- **J1 — Pure trash rules (TDD):** `src/features/vault/trash/trashRules.ts` — `applySoftDelete(cred, now) → cred & { deletedAt: now }`; `restore(cred) → cred & { deletedAt: undefined }`; `partitionTrashed(credentials) → { active, trashed }`; `isExpired(cred, now, retentionDays = 30) → boolean`. Tests: soft-delete stamps timestamp; restore clears it; partition splits correctly (incl. empty); retention boundary (day 29/30/31); trashed items never returned by active partition.
- **J2 — Schema v11 (additive, no data rewrite):** add plaintext `deletedAt?: number` to `StoredCredential` + index `[userId+deletedAt]`; migration body empty (precedent: pure additive versions). Document in `docs/guides/database-migration.md`. Test: `TrustVaultDB` version bump; `database-migration` doc updated.
- **J3 — Store wiring (TDD):** `credentialStore` gains `moveToTrash(id)`, `restoreFromTrash(id)`, `purgePermanently(id)`, `getTrashed()` (filtered, non-realtime reactive via existing list selector). Tests with mocked repo: state transitions, active list excludes trashed, purge hard-deletes.
- **J4 — Trash UI (TDD):** new `TrashPage` (route `/trash`) + `TrashItemCard`/`RestoreConfirmDialog` components — list trashed, restore (undo-style snackbar), permanent delete with confirm, empty state, "empty trash" bulk action. Component tests first (mocked store), then page wiring.
- **J5 — Retention purge (TDD):** pure `purgeExpired(credentials, now)` used on app init (post-unlock) — expired trashed items are permanently deleted; unit-tested independently of the store.

**Acceptance:** J1–J3 fully green before J4 UI; `credential-crud` integration tests still green; delete flow now lands in Trash (manual verification recorded); F9 E2E green; deletion is reversible with no data loss.

### WS-K — Password history + restore (NEW, Bitwarden-parity)

> Precedent: Bitwarden keeps the last 5 passwords per item (encrypted) with timestamps and a "restore previous password" action. TrustVault tracks only `lastAccessedAt`.

- **K1 — Pure history rules (TDD):** `src/features/vault/history/passwordHistory.ts` — `appendPasswordHistory(history, newPassword, now, maxEntries = 5) → PasswordHistoryEntry[]` (most-recent-first; skip if unchanged; cap evicts oldest); `latestPassword(history) → entry | undefined`; `canRestore(history) → boolean`; `formatChangedAt(entry, now)` (reuses `timeFormat` conventions). **History entries are sensitive — never logged, never echoed into errors** (assert in tests). Tests: cap/eviction, dedupe of unchanged password, ordering, empty history, restore availability.
- **K2 — Schema v11 (additive):** add `encryptedPasswordHistory?: string` to `StoredCredential` (AES-256-GCM JSON blob — same pattern as `encryptedBackupCodes`). Vault-key-dependent, so no migration-time backfill; populated on save (encrypt on write, decrypt on read via existing repo encryption helpers). Tests: repo round-trip encrypt/decrypt with mocked `vaultKey`.
- **K3 — Store wiring (TDD):** on credential save/update, the repo appends the previous password to history before overwriting; `getPasswordHistory(id)` decrypts and returns entries. Tests with mocked crypto: previous value captured, unchanged save adds nothing, cap enforced end-to-end.
- **K4 — History UI (TDD):** `PasswordHistoryDialog` (new component) — renders last 5 entries w/ relative timestamps; "Restore previous password" action calls store (requires confirmation); disabled state when no history; opened from `CredentialDetailPage`/`CredentialDetailsDialog`. Component tests first (mocked store), then page wiring.

**Acceptance:** K1–K3 fully green before K4; full-suite green; manual round-trip recorded; restore updates the credential and appends the (then-current) password to history (no infinite loop — assert in tests).

### WS-L — Per-item master-password re-prompt (NEW, Bitwarden-parity)

> Precedent: Bitwarden's "Master password re-prompt" hides sensitive fields until the master password is re-entered for that item. TrustVault already has `verifyPassword(input, storedHash)` in `core/crypto/password.ts` — no core changes.

- **L1 — Pure rules (TDD):** `src/features/vault/reprompt/masterPasswordReprompt.ts` — `isRepromptRequired(cred) → boolean` (flag present + vault unlocked); `evaluateReprompt(input, storedHash) → Promise<boolean>` (delegates to `verifyPassword`; constant-time; no new crypto code); `maskedFields(cred) → ('password' | 'totpSecret' | 'cardNumber' | 'cvv' | ...)[]` (which sensitive fields are gated). Tests: flag off → no gating; flag on → fields listed; wrong input false; right input true; unknown hash format propagates `false` (no crash).
- **L2 — Schema v11 (additive):** plaintext `requiresMasterPasswordReprompt?: boolean` on `Credential` (domain) + `StoredCredential` (data). No index needed (not queried by it). No migration backfill (absent = false).
- **L3 — Form toggle (TDD):** `AddCredentialPage`/`EditCredentialPage` gain the "Require master password to view" toggle (persisted through `useCredentialForm`, WS-B). Tests: toggle renders; value round-trips through B1/B2 validation + save.
- **L4 — Gate UI (TDD):** `MasterPasswordRepromptDialog` (new component) — prompts for master password when opening a flagged item; wrong password → inline error + stays masked; correct → reveals; cancel → stays masked; loading during verify. **Escape/cancel must not reveal anything** (explicit test). Component tests first; wired into `CredentialDetailPage`/`CredentialDetailsDialog`.

**Acceptance:** L1–L3 green before L4; no core crypto changes; re-prompt is per-item (vault lock behavior untouched); F10 E2E green; masked state never leaks via DOM (assert password value absent from `document.body.textContent`).

### WS-M — Generator history (NEW, Bitwarden-parity)

> Precedent: Bitwarden keeps a session-scoped list of recently generated passwords that is cleared on lock/logout. TrustVault's generator exists but has no history.

- **M1 — Pure rules (TDD):** `src/features/vault/generatorHistory/generatorHistory.ts` — `pushGenerated(history, value, now, cap = 10) → string[]` (most-recent-first, dedupe consecutive, cap evicts); `clearHistory() → []`; `canReuse(history, value) → boolean`. **History is sensitive — never persisted, never logged** (assert in tests). Tests: push/order/dedupe/cap; clear; reuse flag.
- **M2 — Store wiring (TDD):** module-level session store (Zustand or module singleton) with `generatorHistory`, `addToHistory(value)`, `clearGeneratorHistory()`, `lastGenerated`. Tests with mocked store: add/clear; **`clearGeneratorHistory` invoked on `lockVault` and `logout`** (wire in `authStore`/`useAutoLock` — the memory-scrub pattern already used for `vaultKey`).
- **M3 — UI (TDD):** `PasswordGeneratorDialog` + `PasswordGeneratorPage` show "Recent" list (tap to reuse/copy), a clear button, and empty state. Component tests first (mocked store); lock-wipe behavior covered by M2 tests + one page-level test.

**Acceptance:** M1–M2 green before M3; wiping on lock/logout asserted; no persistence anywhere (not in localStorage/IndexedDB); full-suite green.

### WS-N — Audit report parity: unsecured-websites + inactive-2FA (NEW, Bitwarden-parity)

> Precedent: Bitwarden's Security tab reports *Unsecured websites* (`http://`) and *Inactive 2FA* (site supports 2FA per 2fa.directory, user hasn't configured it). TrustVault's engine (WS-A) has weak/reused/old/breached only. **Offline-first constraint:** no runtime calls to 2fa.directory — a bundled static dataset is used instead.

- **N1 — Pure rules (TDD, extends WS-A engine):** in `securityAuditEngine.ts` add issue types `unsecured_website` and `inactive_2fa` + rules:
  - `unsecured_website`: credential URL with `http://` scheme (not `https://`; `url.ts` helper for scheme extraction) — fire for any http URL.
  - `inactive_2fa`: credential's registrable domain is in the bundled 2FA-support dataset **and** `totpSecret` is absent — fire with the domain as the actionable hint.
  - Exclusions: no URL → neither rule; `localhost`/private hosts excluded from `inactive_2fa`; credit-card/note categories excluded from `unsecured_website`.
  - Tests: scheme detection (http/https/missing/malformed); dataset hit + totp present → no issue; dataset hit + totp absent → issue; unknown domain → no issue; `localhost` excluded; categories excluded; both new types count into `countIssuesByType` and score deltas are pinned.
- **N2 — Bundled dataset (build-time, offline):** `src/features/vault/audit/twoFactorSites.ts` — generated from the public 2fa.directory dataset via a checked-in generator script (`scripts/generate-2fa-dataset.js`, Node-only, run manually + on release). Ships a **curated, versioned subset** (top domains, ~1–3k entries) with provenance + generation date in a header comment. **No runtime network.** Dataset format: `Record<string /* registrable domain */, true>`.
- **N3 — Engine integration tests:** WS-A engine suite extended for N1 rules; `SecurityAuditPage` renders the two new report rows/groups (mocked engine data); counts on `DashboardPage` remain consistent.

**Acceptance:** N1 green (pure, no DOM) before N2/N3; dataset generator runs clean and produces deterministic output (asserted by a snapshot test); page renders new reports; no network calls added to the runtime bundle (verified by a bundle/`connect-src` review — CSP `connect-src` unchanged).

---

## 5. New/Changed File Map

**New — production modules:**
- `securityAuditEngine.ts` (+ N1 extension), `credentialFormValidation.ts`, `useCredentialForm.ts`
- `features/vault/csv/csvExport.ts` + `csvImport.ts`
- `features/vault/trash/trashRules.ts` (J1), `features/vault/history/passwordHistory.ts` (K1), `features/vault/reprompt/masterPasswordReprompt.ts` (L1), `features/vault/generatorHistory/generatorHistory.ts` (M1)
- `features/vault/audit/twoFactorSites.ts` + `scripts/generate-2fa-dataset.js` (N2)
- `timeFormat.ts` extension (H1)
- **New components:** `TrashPage`, `TrashItemCard`/`RestoreConfirmDialog` (J4), `PasswordHistoryDialog` (K4), `MasterPasswordRepromptDialog` (L4)

**New — schema v11 (additive, Dexie):** `StoredCredential.deletedAt` (+`[userId+deletedAt]` index), `StoredCredential.requiresMasterPasswordReprompt`, `StoredCredential.encryptedPasswordHistory`. Documented in `docs/guides/database-migration.md`.

**New — deps (approved):** `papaparse` (runtime), `@types/papaparse` (dev), `axe-core` (dev).

**New — tests:** `securityAuditEngine.test.ts`, `credentialFormValidation.test.ts`, `useCredentialForm.test.ts`, `csvExport.test.ts`, `csvImport.test.ts`, `lastAccessedFormat.test.ts`, `trashRules.test.ts`, `passwordHistory.test.ts`, `masterPasswordReprompt.test.ts`, `generatorHistory.test.ts`, `twoFactorSites.snapshot.test.ts`, schema-v11 migration tests, 33 component test files (WS-C), 10 page test files (WS-D), new-component tests (J4/K4/L4/M3), axe helper in `src/test/setup.ts`.

**New — E2E:** `e2e/auth-journey.spec.ts`, `credential-crud.spec.ts`, `security-flows.spec.ts`, `offline-drill.spec.ts`, `security-audit.spec.ts`, `a11y-focus.spec.ts`, `trash-lifecycle.spec.ts` (F9), `reprompt-journey.spec.ts` (F10), `e2e/fixtures/` (unique-user + storageState helpers).

**Changed (refactor only, after tests pass):** `SecurityAuditPage.tsx`, `DashboardPage.tsx` (WS-A/N), `AddCredentialPage.tsx`, `EditCredentialPage.tsx` (WS-B/L3), `ExportDialog.tsx`, `ImportDialog.tsx` (WS-E), `CredentialDetailPage.tsx`, `CredentialDetailsDialog.tsx` (WS-H/J/K/L), `DeleteConfirmDialog.tsx` (WS-J — confirm moves to Trash instead of hard delete), `PasswordGeneratorDialog.tsx`, `PasswordGeneratorPage.tsx` (WS-M), `credentialStore.ts` (J3/K3), `database.ts` (v11), `authStore.ts`/`useAutoLock` wiring (M2 lock-wipe), dialog focus/aria fixes (WS-H), WS-G test-file fixes. Docs: this plan, TEST_STATUS, audit-checklist, database-migration, ROADMAP (acceptance criteria).

---

## 6. Validation Gates

**Prerequisite:** `npm install` (workspace ships without `node_modules`).

```bash
npx vitest run <new/affected test files>      # RED + GREEN per task
npm run type-check                            # 0 errors
npx eslint <touched files>                    # 0 new problems vs. re-measured baseline
npx vitest run src/__tests__/integration/     # no regressions on related flows
npm run e2e                                   # WS-F: Playwright green (Chromium locally)
```

**Full-suite runs** (workstream boundaries, not per task — scrypt-heavy suites are slow):
```bash
npm run test -- --testTimeout=30000           # constrained-env requirement (TEST_STATUS)
npm run test:coverage                         # thresholds: lines/functions/statements ≥85, branches ≥80
npm run lint                                  # ≤ baseline; ≥13 fewer after WS-G
```

**Final gates:** `npm run test` **1415/1415**; lint ≤ baseline and reduced; `npm run e2e` green; `type-check` 0; coverage thresholds held; CSP `connect-src` unchanged (WS-N adds no network).

---

## 7. Risks & Notes

- **License guardrail (v4):** Bitwarden's `clients`/`server`/`mobile`/`android`/`ios` are **GPL-3.0**; TrustVault is **Apache-2.0** (`LICENSE`). Only *patterns* (UX flows, data shapes, report semantics) are adopted — **never** GPL source files, code, or structures. No Bitwarden code may be copied, translated, or adapted; no attribution/NOTICE changes are expected. The 2fa.directory dataset is separately licensed (public-domain-style facts about domains — see its license in the generator script header) and is consumed as *data*, not code. If any task ever needs a concrete implementation from a GPL project, stop and escalate instead of porting it.
- **Schema v11 additive (WS-J/K/L):** no destructive index changes; `encryptedPasswordHistory` follows the v5/v10 precedent (vault-key-dependent writes happen post-login/on-save, never inside `.upgrade()`). Migration tests must run against fake-indexeddb, not the browser.
- **Trash retention policy (WS-J):** 30-day default (Bitwarden parity), constant extracted for tests; purge runs on unlock (offline-safe). Hard delete remains available from Trash (explicit user action) — soft-delete never blocks a deliberate permanent delete.
- **Password history sensitivity (WS-K):** entries are real passwords at rest — encrypted with the vault key; **never logged, never rendered in full in tests, never echoed in errors**. Restore must append the current password to history before overwriting (no loop). Cap of 5 keeps storage bounded.
- **Re-prompt UX (WS-L):** per-item gate only; vault lock/auto-lock behavior is untouched. Masking must be airtight — tests assert no sensitive text in `document.body.textContent` while masked, and Escape/cancel never reveals.
- **Generator history (WS-M):** in-memory only; wipe on lock + logout is the security control and is explicitly tested. Never persisted to localStorage/IndexedDB.
- **Inactive-2FA data (WS-N):** bundled, versioned, curated dataset with provenance; no runtime fetch (CSP unchanged). False negatives are acceptable (missing domains simply don't report); false positives avoided via registrable-domain matching + exclusions. Dataset updates are a release-time step (documented in the generator script).
- **SecurityAudit parity (WS-A/N):** module tests pin existing rules before rewiring; WS-N adds issue types as additive union members with pinned score deltas; manual side-by-side comparison for both SecurityAudit **and** Dashboard.
- **Settings/Import/Export jsdom history:** WS-D pins dialog gating; WS-E must not introduce navigation side effects.
- **CSV (WS-E):** `papaparse` config pinned (header detection, `dynamicTyping: false`, skip-empty-lines); injection guard is a security control, not optional.
- **E2E determinism (WS-F):** unique user per spec, `storageState` bootstrap, HIBP mocked via `page.route`; no shared state; `retries: 2` is CI-only.
- **Playwright browsers:** `npx playwright install chromium` may be required locally (environment step).
- **a11y (WS-H):** jsdom cannot verify real focus — axe rules + structural assertions in unit tests, real focus behavior in WS-F F7.
- **Exhaustive coverage cost (owner decision):** 33 component + 10 page test files is deliberate; behavior-focused conventions keep them maintainable. Trivial components get minimal smoke tests, not exhaustive permutations.
- **Lint baseline drift:** G4's gate prevents expansion; baseline re-measured at execution (G1).
- Keep each workstream's diff small and independent so partial completion leaves the suite green.

---

## 8. References

**Project docs:** `TESTING_PATTERNS.md` (conventions/coverage), `TEST_STATUS.md` (baseline + evidence ledger), `ROADMAP.md` (gaps), `GAP_ANALYSIS.md` §17 (verified gaps) + §11 (sizes), `audit-checklist.md` (WCAG scratchpad), `MODULE_CONTRACTS.md` (APIs to preserve), `database-migration.md` (schema v11), `e2e/README.md` + `playwright.config.ts` (E2E conventions), `AGENTS.md` (DoD, guardrails).

**Verified online sources (best practices applied):**
- Kent C. Dodds — *The Testing Trophy and Testing Classifications*; *Write tests. Not too many. Mostly integration.*; *Testing Implementation Details* (kentcdodds.com/blog)
- React Testing Library — official docs + guiding principles (testing-library.com) — behavior over implementation; `user-event`
- Playwright — *Best Practices* docs (playwright.dev/docs/best-practices) — web-first assertions, test isolation, state setup, `page.route`, `context.setOffline`

**Bitwarden benchmark sources (v4 — verified 2026-08-02):**
- `github.com/orgs/bitwarden/repositories` — org inventory (68 repos; `clients` = Angular web/browser/desktop/CLI under GPL-3.0)
- `github.com/bitwarden/clients` — web vault structure, Cipher Form / item add-edit architecture, import/export parsers, Security/Reports components
- Bitwarden Help Center — Trash & retention (30 days), password history & restore, master password re-prompt, generator history, Security/Reports report semantics (2fa.directory for inactive-2FA, `http://` detection for unsecured websites)
- 2fa.directory — public dataset of sites supporting 2FA (data source for WS-N; bundled, offline)
