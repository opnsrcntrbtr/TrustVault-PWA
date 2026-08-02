# TDD Improvement Plan — Presentation Components & Pages (v3, reviewed)

**Date:** 2026-08-02
**Status:** Planned (awaiting approval; execution happens in later sessions, one workstream at a time)
**Program type:** Mixed — targeted refactoring + exhaustive component/page coverage + documented feature gaps + E2E (Playwright) + test-suite debt cleanup, every change driven by Test-Driven Development (red → green → refactor)
**Target areas:** `src/presentation/pages/**`, `src/presentation/components/**`, `src/presentation/hooks/**`, `src/features/**` (CSV, audit helpers), `e2e/**`
**Revision:** v3 (2026-08-02) — adversarial review applied (verified against project state + authoritative sources: Testing Trophy / Testing Library docs / Playwright best practices). **Coverage model: exhaustive** (owner decision — every component/page gets direct tests). **Dependency policy: `axe-core` + `papaparse` approved.**

---

## 1. Context & Baseline (verified 2026-08-02)

TrustVault PWA is feature-complete (7 phases + AI; **1414/1415 tests passing** per `docs/testing/TEST_STATUS.md`). This plan targets the **presentation layer** and its supporting E2E/test hygiene.

**Verified inventory (shell counts, Node v22.23.1):**
- **Components:** 45 (`src/presentation/components/`: 41 + `ai/`: 4). Tested: **12** → **33 untested** (all targeted by WS-C).
- **Pages:** 12 (README.md is not a page). Direct tests: 2 (`PasswordGeneratorPage`, `UnlockPage`).
- **Test files:** 115 colocated `*.test.ts(x)` under `src/`. (Docs cite "119" — likely includes config/test-helper files; 115 is the verified colocated count.)
- **E2E:** 1 smoke spec (`e2e/login.spec.ts`), Playwright config present (`baseURL: http://localhost:3000/TrustVault-PWA` — matches Vite `base` since `VERCEL` is unset).
- **Lint baseline:** documented ~853–855 problems across TEST_STATUS snapshots; **must be re-measured at execution time** (workspace has no `node_modules` until `npm install` runs).

### 1.1 Pages — direct test status

| Page | Direct tests | Integration coverage | Plan |
|---|---|---|---|
| `PasswordGeneratorPage.tsx` | ✅ 5/5 | ✅ | Baseline; no new work |
| `UnlockPage.tsx` | ✅ | ✅ | Baseline; no new work |
| `DashboardPage.tsx` | ❌ | ✅ `credential-crud`, `dashboard-sort` | WS-D (+ WS-A score dedupe) |
| `FavoritesPage.tsx` | ❌ | ❌ | WS-D |
| `CredentialDetailPage.tsx` | ❌ | ❌ | WS-D, WS-H |
| `AddCredentialPage.tsx` | ❌ | ✅ `credential-crud` | WS-B (610-line monolith) |
| `EditCredentialPage.tsx` | ❌ | ❌ | WS-B (733-line monolith) |
| `SecurityAuditPage.tsx` | ❌ | ❌ (manual only) | WS-A (issue engine inline) |
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

All 8 hooks, all 5 stores, all 5 utils have tests. No new work except hooks introduced by WS-B/WS-H.

### 1.4 Documented gaps in scope

| Gap | Source | Workstream |
|---|---|---|
| CSV import/export | ROADMAP; GAP_ANALYSIS §17 #6 | WS-E |
| Credential history view | GAP_ANALYSIS §12/#12 | WS-H |
| WCAG 2.1 AA audit | GAP_ANALYSIS §17 #9 | WS-H |
| TOTP SMS fallback (stub) | GAP_ANALYSIS §17 #5 | WS-H (deferred, flagged) |
| E2E = 1 smoke spec | GAP_ANALYSIS §13 | WS-F |
| 13 lint errors in test files; 1 flake; timer flakiness | ROADMAP; TEST_STATUS | WS-G |

### 1.5 Coverage targets

`vitest.config.ts` enforces lines ≥85 / functions ≥85 / branches ≥80 / statements ≥85. `TESTING_PATTERNS.md`: components ≥70%. **Owner decision: exhaustive direct coverage of all 33 components + 10 pages is in scope** — tests must be *behavior-focused* (user-observable) so exhaustiveness does not produce brittle "coverage theater" (see §3).

---

## 2. Goals & Non-Goals

### Goals
1. Move security-critical, business logic **out of components into pure, unit-tested modules** (testable without DOM/jsdom).
2. **Exhaustive direct test coverage** of every presentation component (33) and page (10) — behavior-focused, per §3 conventions.
3. Ship documented **CSV import/export** (via `papaparse`) **with CSV-injection protection**, tests first.
4. Ship the **credential history view** and a **WCAG 2.1 AA audit** (axe-core-assisted, TDD for testable fixes).
5. Grow **Playwright E2E** from 1 smoke spec to critical-journey coverage using verified Playwright best practices (web-first assertions, isolated state, `storageState` bootstrap, `page.route` mocks, `context.setOffline`).
6. **Zero test-suite debt**: fix the 13 lint errors in test files, the known flake, and timer nondeterminism; final full-suite target **1415/1415**.
7. Adopt **verified testing best practices**: RTL `user-event` over `fireEvent` (behavior, not implementation); web-first assertions in E2E; static analysis (TS/ESLint) as the base layer.

### Non-Goals
- No changes to crypto/auth/breach **core** modules (≥90% covered).
- No full rewrite of pages — decomposition only where it enables testing or removes duplication.
- New deps are **approved and enumerated**: runtime `papaparse` (+ `@types/papaparse` dev); dev `axe-core`. No other new dependencies without explicit approval.
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
- Fixtures from `src/__tests__/fixtures/`; `@/` aliases; no `console.log`; **never log secrets** (incl. password columns in CSV errors).

---

## 4. Workstreams & Tasks

> Order = value/risk. Independent workstreams; finish one task (incl. validation) before starting the next. WS-A/B/E are prerequisites to their downstream rewiring.

### WS-A — Extract & test Security Audit logic (highest value)

**A1 — Pure module `securityAuditEngine` (TDD, no DOM)**
- New: `src/presentation/pages/securityAuditEngine.ts`. Exports: `buildSecurityIssues(credentials, breachedCredentials, opts?) → SecurityIssue[]`, `computeSecurityScore(credentials) → number`, `countIssuesByType(issues)`, `formatAgeDays(updatedAt, now)`, plus the `SecurityIssue` **type** (exported for reuse).
- Port rules exactly from `analyzeCredentials()` (breach-priority; missing-password; weak `<60`/`<40` bands; reused via password map; old `>365`/`>730`; plain-avg score). Pure & synchronous — breach data is *pre-loaded* by the caller.
- Tests: each issue type fires; band boundaries (39/40, 59/60); breach outranks weak; reused aggregation + single issue; empty vault → score 0/no issues; age boundaries (365/366, 730/731); zeroed `issuesByType` shape; deterministic ids.
- **Dedupe (review finding):** `DashboardPage` computes the same plain-avg score inline — rewire it to consume `computeSecurityScore` too (kills the duplicated logic).

**A2 — Score/label helpers (TDD):** extract `getScoreColor`, `getScoreLabel`, `getSeverityColor`, `getSeverityIcon` (mappings pure; icon JSX stays in page). Tests: label/color boundaries (80/60/40); all five severities + unknown fallback.

**Acceptance:** A1–A2 green; `SecurityAuditPage` **and** `DashboardPage` consume the module with identical output; no new lint.

### WS-B — Decompose Add/Edit credential monoliths

**B1 — Pure validation (TDD):** `src/presentation/pages/credentialFormValidation.ts` — `validateCredentialForm(input) → { valid, errors: { title?, username?, password?, url?, category? } }` (URL via `url.ts`, password min 12 parity with signup, tag cap). Tests: per-field rules, valid form, boundaries (11/12 chars, empty title, bad URL, tag cap), errors only for failing fields.
**B2 — Shared `useCredentialForm` hook (TDD):** `src/presentation/hooks/useCredentialForm.ts` — state, handlers, validate-on-submit, dirty tracking, edit-mode seeding, reset. Tests (`renderHook`): seed, immutable edits, `onSave` only-when-valid, errors clear on fix, dirty toggles, reset.
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
| `PasswordGeneratorDialog` | renders password; regenerate; copy; insert callback |
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
- `CredentialDetailPage`: loading → rendered; missing → error + back; edit navigates; delete confirm path calls repo → navigates; favorite toggle updates UI.
- `SecurityAuditPage` (post WS-A): renders score + issues from mocked engine; scan button triggers `scanForBreaches`; disabled while scanning.
- `SettingsPage`: sections render; dialog open/close gating for Change Password / Export / Import (pins the historic jsdom mis-click regression); no `setTimeout(navigate)` side effects.
- `AddCredentialPage` / `EditCredentialPage` (post WS-B): mount with mocked `useCredentialForm`; save/cancel wiring; edit pre-fill.
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

- **F1 — Infrastructure & isolation:** `e2e/fixtures/` helpers — unique user per spec; clear IndexedDB in `beforeEach`; **auth bootstrap via `storageState`** (one signup → save state → reuse for CRUD/security/audit specs, keeping the suite fast — Playwright's state-driven setup pattern); verify existing `login.spec.ts` green on Chromium + CI WebKit.
- **F2 — Auth journey:** signup → vault setup → lock → unlock (master password) → logout → login; assert URL transitions + lock gating. *(No `storageState` shortcut here — this journey is the feature under test.)*
- **F3 — Credential CRUD:** add (with generator), edit, favorite toggle, search filter, detail view, delete; assert persistence across navigation.
- **F4 — Security flows:** auto-lock (short timeout); change master password → re-login; export `.tvault` → import (merge); backup-code reveal.
- **F5 — PWA/offline drill:** `context.setOffline(true)` → reload → unlock → dashboard renders from IndexedDB; `OfflineIndicator` visible; restore online.
- **F6 — Security Audit:** seed weak-password credential; run "Scan All"; assert issue list + lower score. HIBP endpoint mocked via `page.route`.
- **F7 — A11y focus journeys (cross-link from WS-H):** dialogs open → focus moves into dialog; Escape closes and focus returns to trigger — asserted in real browser where jsdom cannot.
- **F8 — Cross-browser:** CI matrix Chromium + WebKit; documented skips (WebAuthn — manual only).

**Acceptance:** `npm run e2e` green (Chromium locally); web-first assertions only; deterministic (isolated state per spec); each spec maps to a documented user journey.

### WS-G — Test-suite debt cleanup

- **G1 — Fix 13 ESLint errors in test files** (non-null assertions, deprecated fields): targeted eslint per file; no production-code changes. **Re-measure the full baseline first** (`npm run lint`) to record the true starting number.
- **G2 — Fix the known flake:** `import-export.test.tsx` "reject import with wrong password" → deterministic (explicit await, fake timers or stronger bound); green in isolation **and** full suite.
- **G3 — Timer determinism audit:** TOTP, clipboard, `useAutoLock` suites — all timer paths via `vi.useFakeTimers()`; no real `setTimeout` waits.
- **G4 — Lint gate:** `npm run lint` must not exceed baseline at any commit; touched files **0 new**; baseline deltas tracked in TEST_STATUS.
- **G5 — Evidence:** TEST_STATUS per-fix results (isolated + full-suite).

**Acceptance:** lint baseline reduced (≥13 fewer) with zero new; full suite 1415/1415 at program end.

### WS-H — Documented feature gaps (credential history + a11y)

- **H1 — Credential history view (TDD):** `lastAccessedAt` already tracked. Pure helper (`timeFormat.ts` extension): `formatLastAccessed(cred, now)` — tests: today/yesterday/N-days/months; never-accessed; undefined guards. Component: metadata rows in `CredentialDetailPage`/`CredentialDetailsDialog` (Created/Updated/Last accessed); hidden for missing values.
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

---

## 5. New/Changed File Map

**New — production modules:** `securityAuditEngine.ts`, `credentialFormValidation.ts`, `useCredentialForm.ts`, `features/vault/csv/csvExport.ts` + `csvImport.ts`, `timeFormat.ts` extension (H1).

**New — deps (approved):** `papaparse` (runtime), `@types/papaparse` (dev), `axe-core` (dev).

**New — tests:** `securityAuditEngine.test.ts`, `credentialFormValidation.test.ts`, `useCredentialForm.test.ts`, `csvExport.test.ts`, `csvImport.test.ts`, `lastAccessedFormat.test.ts`, 33 component test files (WS-C), 10 page test files (WS-D), axe helper in `src/test/setup.ts`.

**New — E2E:** `e2e/auth-journey.spec.ts`, `credential-crud.spec.ts`, `security-flows.spec.ts`, `offline-drill.spec.ts`, `security-audit.spec.ts`, `a11y-focus.spec.ts`, `e2e/fixtures/` (unique-user + storageState helpers).

**Changed (refactor only, after tests pass):** `SecurityAuditPage.tsx`, `DashboardPage.tsx` (WS-A), `AddCredentialPage.tsx`, `EditCredentialPage.tsx` (WS-B), `ExportDialog.tsx`, `ImportDialog.tsx` (WS-E), `CredentialDetailPage.tsx`, `CredentialDetailsDialog.tsx` (WS-H), dialog focus/aria fixes (WS-H), WS-G test-file fixes. Docs: this plan, TEST_STATUS, audit-checklist.

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

**Final gates:** `npm run test` **1415/1415**; lint ≤ baseline and reduced; `npm run e2e` green; `type-check` 0; coverage thresholds held.

---

## 7. Risks & Notes

- **SecurityAudit parity (WS-A):** module tests pin existing rules before rewiring; manual side-by-side score comparison for both SecurityAudit **and** Dashboard before refactor.
- **Settings/Import/Export jsdom history:** WS-D pins dialog gating; WS-E must not introduce navigation side effects.
- **CSV (WS-E):** `papaparse` is battle-tested, but its config must be pinned (header detection, `dynamicTyping: false`, skip-empty-lines) — tests lock the exact behavior. Injection guard is a security control, not optional.
- **E2E determinism (WS-F):** unique user per spec, `storageState` bootstrap, HIBP mocked via `page.route`; no shared state; `retries: 2` is CI-only.
- **Playwright browsers:** `npx playwright install chromium` may be required locally (environment step).
- **a11y (WS-H):** jsdom cannot verify real focus — axe rules + structural assertions in unit tests, real focus behavior in WS-F F7.
- **Exhaustive coverage cost (owner decision):** 33 component + 10 page test files is deliberate; behavior-focused conventions keep them maintainable. Trivial components get minimal smoke tests (render + key interaction), not exhaustive permutations.
- **Lint baseline drift:** G4's gate prevents expansion; baseline re-measured at execution (G1).
- Keep each workstream's diff small and independent so partial completion leaves the suite green.

---

## 8. References

**Project docs:** `TESTING_PATTERNS.md` (conventions/coverage), `TEST_STATUS.md` (baseline + evidence ledger), `ROADMAP.md` (gaps), `GAP_ANALYSIS.md` §17 (verified gaps) + §11 (sizes), `audit-checklist.md` (WCAG scratchpad), `MODULE_CONTRACTS.md` (APIs to preserve), `e2e/README.md` + `playwright.config.ts` (E2E conventions), `AGENTS.md` (DoD, guardrails).

**Verified online sources (best practices applied):**
- Kent C. Dodds — *The Testing Trophy and Testing Classifications* (kentcdodds.com/blog/the-testing-trophy-and-testing-classifications); *Write tests. Not too many. Mostly integration.* (kentcdodds.com/blog/write-tests); *Testing Implementation Details* (kentcdodds.com/blog/testing-implementation-details)
- React Testing Library — official docs + guiding principles (testing-library.com) — behavior over implementation; `user-event`
- Playwright — *Best Practices* docs (playwright.dev/docs/best-practices) — web-first assertions, test isolation, state setup, `page.route`, `context.setOffline`
