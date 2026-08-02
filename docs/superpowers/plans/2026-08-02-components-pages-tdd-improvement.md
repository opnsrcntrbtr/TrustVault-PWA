# TDD Improvement Plan — Presentation Components & Pages (Broadened)

**Date:** 2026-08-02
**Status:** Planned (awaiting approval; execution happens in later sessions, one workstream at a time)
**Program type:** Mixed — targeted refactoring + full component/page coverage + documented feature gaps + E2E (Playwright) + test-suite debt cleanup, every change driven by Test-Driven Development (red → green → refactor)
**Target areas:** `src/presentation/pages/**`, `src/presentation/components/**`, `src/presentation/hooks/**`, `src/presentation/store/**`, `src/features/**` (CSV, audit helpers), `e2e/**`
**Revision:** v2 (2026-08-02) — broadened per owner direction: **all** untested components, documented feature gaps, E2E, test-suite debt; deepened per-task detail.

---

## 1. Context & Baseline

TrustVault PWA is feature-complete (7 phases + AI; **1414/1415 tests passing, 119 files** per `docs/testing/TEST_STATUS.md`). This plan targets the **presentation layer** and its supporting E2E/test hygiene:

### 1.1 Pages (13) — direct test status

| Page | Direct tests | Integration coverage | Notes |
|---|---|---|---|
| `PasswordGeneratorPage.tsx` | ✅ 5/5 | ✅ `password-generator.test.tsx` | Reference baseline; no new work |
| `UnlockPage.tsx` | ✅ | ✅ auth-flow | Reference baseline; no new work |
| `DashboardPage.tsx` | ❌ | ✅ `credential-crud`, `dashboard-sort` | Stats/filter logic inline → WS-D |
| `FavoritesPage.tsx` | ❌ | ❌ | → WS-D |
| `CredentialDetailPage.tsx` | ❌ | ❌ | Copy/delete/favorite flows → WS-D |
| `AddCredentialPage.tsx` | ❌ | ✅ `credential-crud` | **610-line monolith** → WS-B |
| `EditCredentialPage.tsx` | ❌ | ❌ | **733-line monolith** → WS-B |
| `SecurityAuditPage.tsx` | ❌ | ❌ (manual only) | ~470 lines; issue engine inline → WS-A |
| `SettingsPage.tsx` | ❌ | ✅ `master-password-change`, `import-export` | Dialog-gating area (historic jsdom mis-click) → WS-D |
| `LoginPage.tsx` / `SigninPage.tsx` / `SignupPage.tsx` | ❌ | ✅ `auth-flow` | Validation + biometric-button gating → WS-D |

### 1.2 Components (48) — direct test status

**Tested (12):** `AiAssistanceSettings`, `BackupCodeInput`, `BackupCodesModal`, `BreachDetailsModal`, `ErrorBoundary`, `OcrOverlaySettings`, `PasswordStrengthIndicator`, `SortDropdown`, `ai/BreachInsightCard`, `ai/ChatPanel`, `ai/GeneralAssistant`, `ai/StrengthInsightCard`.

**Untested (35 — all targeted by WS-C):**

| Group | Components |
|---|---|
| Credential display & interaction | `CredentialCard`, `CredentialSection`, `CredentialDetailsDialog`, `SwipeableCredentialCard`, `TotpDisplay`, `CategoryIcon` |
| Dialogs & modals | `DeleteConfirmDialog`, `ExportDialog`*, `ImportDialog`*, `PasswordGeneratorDialog`, `ChangeMasterPasswordDialog`, `BiometricSetupDialog`, `CameraScanDialog`, `OcrResultDialog`, `UnlockDialog` |
| Search / filter / input | `SearchBar`, `FilterChips`, `TagInput` |
| Settings controls | `AutoLockSettings`, `ClipboardSettings`, `ClipboardNotification`, `ProfilesSettings`, `ProfileSwitcher`, `ThemeToggle` |
| PWA / chrome / utility | `OfflineIndicator`, `MobileNavigation`, `InstallPrompt`, `UpdateAvailableSnackbar`, `UpdateNotification`, `ReEncryptionProgress`, `BreachAlertBanner`, `CryptoAPIError`, `RouteErrorBoundary` |
| Onboarding / help | `OnboardingTour`, `TourHelpButton` |

\* `ExportDialog`/`ImportDialog` are integration-covered (`import-export.test.tsx`) but have no direct unit tests.

### 1.3 Hooks, stores, utils — baseline

All 8 hooks have tests (`useAutoLock`, `usePasswordGenerator`, `useSwipeGesture`, `useServiceWorkerUpdate`, `useAi*`, `useDriverTour`). All 5 stores have tests (`authStore`, `credentialStore`, `profileStore`, `themeStore`, `loadProfiles`). All 5 utils have tests (`clipboard`, `credentialSort`, `performance`, `timeFormat`, `url`). → No new work except hooks introduced by WS-B and WS-H.

### 1.4 Documented gaps (in scope for this program)

| Gap | Source | Workstream |
|---|---|---|
| CSV import/export not implemented | ROADMAP known gaps; GAP_ANALYSIS §17 #6 | WS-E |
| Credential history view (lastAccessedAt tracked, no UI) | GAP_ANALYSIS §12/#12, §17 | WS-H |
| WCAG 2.1 AA audit (partial — zoom fixed, no full audit) | GAP_ANALYSIS §17 #9 | WS-H |
| TOTP SMS fallback (stub) | GAP_ANALYSIS §17 #5 | WS-H (optional, flagged) |
| E2E coverage = 1 smoke spec (`e2e/login.spec.ts`) | GAP_ANALYSIS §13; e2e/README | WS-F |
| 13 ESLint errors in test files; 1 flaky test; timer-test flakiness | ROADMAP gaps; TEST_STATUS | WS-G |

### 1.5 E2E infra (existing)

`playwright.config.ts` — `testDir: ./e2e`, `baseURL: http://localhost:3000/TrustVault-PWA`, `webServer: npm run dev` (port 3000), CI → Chromium + WebKit, `retries: 2` in CI. Scripts: `npm run e2e` / `e2e:ui` / `e2e:headed` / `e2e:debug`. One spec exists (`login.spec.ts` smoke).

**Coverage targets (from `docs/testing/TESTING_PATTERNS.md`):** components ≥70%, overall ≥80%; `test:coverage` enforces lines/statements ≥85% repo-wide.

---

## 2. Goals & Non-Goals

### Goals
1. Move security-critical, business logic **out of components into pure, unit-tested modules** (testable without DOM/jsdom).
2. **100% direct test coverage of every presentation component and page** (no component left without a colocated test file).
3. Ship the documented **CSV import/export** feature with tests written before implementation.
4. Ship the documented **credential history view** and a **WCAG 2.1 AA audit** pass with testable fixes.
5. Grow the **Playwright E2E suite** from 1 smoke spec to full critical-journey coverage.
6. **Zero test-suite debt**: fix the 13 lint errors in test files, the known flake, and timer-test nondeterminism.
7. Keep every change verified by: failing test first → minimal green implementation → safe refactor → full validation battery.

### Non-Goals
- No changes to crypto/auth/breach **core** modules (already ≥90% covered; out of scope).
- No full rewrite of pages — decomposition only where it enables testing or removes duplication.
- No new **runtime** dependencies. New **devDependencies** allowed only with explicit approval (candidates: `axe-core` for the WCAG audit workstream).
- Not fixing the entire repo-wide lint baseline (~855 pre-existing problems) in one pass; debt fixes target test files (WS-G) and guarantee **0 new** issues on every touched file.
- WebAuthn/biometric E2E (requires a physical authenticator) stays in the **manual** verification suite, not Playwright.

---

## 3. TDD Workflow (repo-specific)

Every task follows this loop, committed to `docs/testing/TEST_STATUS.md` per the AGENTS.md convention:

1. **RED** — write the failing test(s) in a colocated `__tests__/` file (`src/presentation/**/__tests__/*.test.ts(x)`). Run: `npx vitest run <new test file>` → confirm failure is for the right reason.
2. **GREEN** — write the minimal production code (new pure module, hook, or component) to pass.
3. **REFACTOR** — rewire the existing component/page to consume the new module. Re-run tests → still green.
4. **VALIDATE** — see §7. Record evidence in `docs/testing/TEST_STATUS.md`.

For **E2E specs** (WS-F): write the spec against the acceptance criteria first (failing against current app if the behavior is missing), then implement, then re-run `npm run e2e` → green. This mirrors red→green for browser-level behavior.

Test conventions (per `TESTING_PATTERNS.md`): use `@/` aliases, fixtures from `src/__tests__/fixtures/` where they exist, `describe`/`it`, `vi.fn()`, `@testing-library/react` for components, `vi.useFakeTimers()` for time logic, no `console.log`. E2E: one unique user per spec (no shared state), clear IndexedDB in `beforeEach`.

---

## 4. Workstreams & Tasks

> Order = value/risk. Workstreams are independent; execute in any order, but finish one task (incl. validation) before starting the next. WS-A, WS-B, WS-E are prerequisite to their downstream rewiring only.

### WS-A — Extract & test Security Audit logic (highest value)

Extract the issue-detection engine from `SecurityAuditPage.tsx` into a pure module; page becomes a thin view.

**A1 — Pure module `securityAuditEngine` (TDD, no DOM)**
- New file: `src/presentation/pages/securityAuditEngine.ts`.
- Export: `buildSecurityIssues(credentials, breachedCredentials, opts?) → SecurityIssue[]`, `computeSecurityScore(credentials) → number`, `countIssuesByType(issues) → issuesByType`, `formatAgeDays(updatedAt, now) → number | undefined`.
- Port the exact rules from `analyzeCredentials()` (breach-priority, missing-password, weak `<60`/`<40` severity bands, reused via password map, old `>365`/`>730`, plain-avg score matching DashboardPage).
- Test cases (`__tests__/securityAuditEngine.test.ts`): each issue type fires; severity band boundaries (score 39/40, 59/60); breach outranks weak for same credential; reused aggregation groups titles and emits one issue; empty vault → score 0 + zero issues; age boundaries (365/366, 730/731); `countIssuesByType` returns zeroed shape; deterministic id format.
- Refactor: `SecurityAuditPage` calls the module; delete inline logic. Keep UI identical.

**A2 — Score/label presentation helpers (TDD)**
- Extract `getScoreColor`, `getScoreLabel`, `getSeverityColor`, `getSeverityIcon` into the module (icon stays in the page; mappings become pure).
- Test cases: label boundaries (80/60/40), color mapping per band, severity→color and severity→icon mapping for all five severities + unknown fallback.
- Refactor page to consume.

**Acceptance:** all A1–A2 tests pass; `SecurityAuditPage` renders identically; no new lint issues.

### WS-B — Decompose Add/Edit credential monoliths

**B1 — Pure credential-form validation (TDD)**
- New file: `src/presentation/pages/credentialFormValidation.ts` with `validateCredentialForm(input) → { valid, errors: { title?, username?, password?, url?, category? } }` (URL via `src/presentation/utils/url.ts`, password min-length 12 parity with signup, tag count cap).
- Test cases: each field rule fires independently; fully valid form → `valid: true`, empty errors; boundaries (11/12-char password, empty title, malformed URL, >cap tags); errors object only contains failing fields.
- Refactor: `AddCredentialPage`/`EditCredentialPage` call it.

**B2 — Shared `useCredentialForm` hook (TDD)**
- New hook `src/presentation/hooks/useCredentialForm.ts`: form state, change handlers, validation on submit, dirty tracking, initial-value seeding (edit mode), reset.
- Test cases (`renderHook`): initial values from seed; edits update state immutably; `onSave` fires only when valid; validation errors surface and clear on fix; dirty flag toggles; edit-mode seed/update; reset restores initial.
- Refactor: both pages consume the hook (removes the largest duplicated chunk of the 610/733-line files).

**Acceptance:** B1–B2 green; `credential-crud.test.tsx` still passes; pages shrink without behavior change.

### WS-C — Direct coverage for ALL untested components (35)

Colocate under `src/presentation/components/__tests__/`; mock stores/services (never real crypto/DB/IndexedDB). Grouped test plans:

**C1 — Credential display & interaction**
| Component | Minimum cases |
|---|---|
| `CredentialCard` | renders title/username/breach badge; menu actions (edit/favorite/delete) fire callbacks; no crash on empty credential; loading state |
| `CredentialSection` | groups credentials by category; renders children per item; empty state |
| `CredentialDetailsDialog` | renders all fields (title/username/password-masked/url/category/tags); copy buttons call handlers; favorite toggle; close; breached alert passthrough |
| `SwipeableCredentialCard` | swipe-left/right reveal actions (mock `useSwipeGesture`); tap resolves; actions fire callbacks |
| `TotpDisplay` | renders 6-digit code; seconds-left formatting with `vi.useFakeTimers()`; window rollover; error/empty states |
| `CategoryIcon` | icon per category; unknown-category fallback; accessible label |

**C2 — Dialogs & modals**
| Component | Minimum cases |
|---|---|
| `DeleteConfirmDialog` | confirm/cancel callbacks; loading disables confirm; credential title shown; escape closes |
| `ExportDialog` | opens with format options (`.tvault`, and CSV after WS-E); password validation (min 12); strength indicator shown; export success/failure feedback |
| `ImportDialog` | file selection; decrypt-wrong-password error; merge vs replace mode radios; progress per item; success summary |
| `PasswordGeneratorDialog` | renders generated password; regenerate; copy; insert-to-form callback |
| `ChangeMasterPasswordDialog` | current/new/confirm validation; mismatch error; strength meter; submit calls handler only when valid |
| `BiometricSetupDialog` | device-support gating; enrollment flow states; failure + retry; close |
| `CameraScanDialog` | camera permission denial; capture calls OCR handler; cancel |
| `OcrResultDialog` | shows parsed fields; edit/confirm/discard actions |
| `UnlockDialog` | password unlock; biometric button (calls handler); error state; loading |

**C3 — Search / filter / input**
| Component | Minimum cases |
|---|---|
| `SearchBar` | typing calls `onChange` (debounced, fake timers); clear button; controlled value |
| `FilterChips` | active-chip highlight; callback with category; "All" resets; disabled state |
| `TagInput` | add on Enter; comma-separated add; duplicate rejection; remove tag; empty-input no-op |

**C4 — Settings controls**
| Component | Minimum cases |
|---|---|
| `AutoLockSettings` | renders options; change persists to settings store; disabled while saving |
| `ClipboardSettings` | renders timeout options; save handler; parity with `clipboard.ts` util defaults |
| `ClipboardNotification` | shows on clipboard event; auto-hides (fake timers); dismiss |
| `ProfilesSettings` | lists profiles; create/rename/delete callbacks; active-profile highlight |
| `ProfileSwitcher` | lists profiles; selection calls store; active check |
| `ThemeToggle` | toggles `themeStore`; icon reflects mode |

**C5 — PWA / chrome / utility**
| Component | Minimum cases |
|---|---|
| `OfflineIndicator` | renders when offline (`navigator.onLine` mock), hidden online |
| `MobileNavigation` | renders nav items; active route highlight; logout action |
| `InstallPrompt` | hidden when criteria unmet; captures `beforeinstallprompt`; install click fires prompt |
| `UpdateAvailableSnackbar` | renders on `updateavailable`; reload action; dismiss |
| `UpdateNotification` | pending-state render; skip-waiting handshake |
| `ReEncryptionProgress` | progress %; completion callback; cancellation |
| `BreachAlertBanner` | renders when breached count > 0; CTA navigates to audit (mock router); dismiss |
| `CryptoAPIError` | renders guidance when crypto API missing; retry callback |
| `RouteErrorBoundary` | catches child error → fallback UI + retry (template: `ErrorBoundary.test.tsx`) |

**C6 — Onboarding / help**
| Component | Minimum cases |
|---|---|
| `OnboardingTour` | renders steps from tour config; completion persists (mock `useDriverTour`); skip |
| `TourHelpButton` | opens tour; only when tour enabled; aria-label |

**Acceptance:** all 35 components have a passing colocated test file; components are unchanged or refactored only for testability (e.g. prop-drilling instead of store reads where trivial).

### WS-D — Page-level behavior tests (all pages)

Targeted unit tests mounting pages with mocked stores/repos/router (avoids duplicating integration happy paths; asserts behavior + error states):

- `DashboardPage`: stats derive from mocked credential list (score avg, counts); search filters list; category filter; empty state; lock button calls store.
- `FavoritesPage`: only favorites render; empty state; unfavorite removes from list.
- `CredentialDetailPage`: loading → rendered; missing credential → error + back action; edit navigates; delete confirm path calls repo then navigates; favorite toggle updates UI.
- `SecurityAuditPage` (post WS-A): smoke — renders score circle + issue list from mocked engine; scan button triggers `scanForBreaches`; disabled while scanning.
- `SettingsPage`: renders sections; dialog open/close gating for Change Master Password / Export / Import (pins the historic jsdom mis-click regression); no `setTimeout(navigate)` side effects.
- `AddCredentialPage` / `EditCredentialPage` (post WS-B): mount with mocked `useCredentialForm`; save/cancel wiring; edit pre-fills.
- `LoginPage` / `SigninPage` / `SignupPage`: validation messages (email format, 12-char password, mismatch); submit calls auth handler; biometric button visibility gated on availability; error display.
- `PasswordGeneratorPage` / `UnlockPage`: existing tests are the baseline — only add missing error/edge cases found while auditing (no duplication).

**Acceptance:** all pass; no `.skip` added; `src/__tests__/integration/` still green.

### WS-E — New feature: CSV import/export (TDD)

The documented gap (GAP_ANALYSIS §17 #6, ROADMAP known gaps).

- **E1** `src/features/vault/csv/csvExport.ts` — `serializeCredentialsCsv(credentials) → string` (RFC 4180 quoting, header row, category/tags encoding, UTF-8 BOM option).
- **E2** `src/features/vault/csv/csvImport.ts` — `parseCredentialsCsv(text) → { rows, errors }` (quoted fields, embedded newlines, header detection + variants, per-row validation; **never** logs plaintext passwords).
- Test cases (E1+E2): round-trip export→parse; quoting (commas, double-quotes, newlines, UTF-8/non-ASCII); header variants (with/without header); malformed row → error entry with row index; empty input; tag/category round-trip; password column never echoed into error messages.
- Wire (after E1/E2 green): add "CSV" format option to `ExportDialog` (Blob download); "CSV" accept to `ImportDialog` (parse → credential inputs → existing Zod/field validation). Keep dialogs' integration tests green.

**Acceptance:** E1/E2 fully unit-tested before wiring; manual export→import round trip recorded in TEST_STATUS.md; C2 dialog tests updated for the new option.

### WS-F — E2E (Playwright): grow from smoke to critical journeys

- **F1 — Infrastructure & isolation:** add `e2e/fixtures/` helpers (unique user per spec, `beforeEach` clears IndexedDB via `page.evaluate`); verify `npm run e2e` (Chromium) and CI WebKit run on the existing `login.spec.ts` without flakes.
- **F2 — Auth journey:** signup → vault setup → lock → unlock (master password) → logout → login. Assert URL transitions and lock-screen gating.
- **F3 — Credential CRUD:** add credential (with generator), edit, favorite toggle, search filter, detail view, delete. Assert persisted state across navigation.
- **F4 — Security flows:** auto-lock with short timeout; change master password (old → new → re-login); export `.tvault` → import round trip (merge mode); backup-code reveal.
- **F5 — PWA/offline drill (automate the manual P1/P4 drills):** `context.setOffline(true)` → reload → unlock → dashboard renders from IndexedDB; `OfflineIndicator` visible.
- **F6 — Security Audit:** seed a credential with a known-weak password; run "Scan All"; assert issue list + lowered score. (HIBP network calls stubbed via `page.route` — k-anonymity endpoint mocked.)
- **F7 — Cross-browser:** keep CI matrix (Chromium + WebKit); document known skips (WebAuthn — manual only).

**Acceptance:** `npm run e2e` green locally (Chromium); specs deterministic (no shared user state); each spec maps to a user-visible journey from the ROADMAP/user guide.

### WS-G — Test-suite debt cleanup

- **G1 — Fix 13 ESLint errors in test files** (non-null assertions, deprecated fields per ROADMAP gaps): targeted `eslint` runs per file; no production-code changes.
- **G2 — Fix the known flake:** `import-export.test.tsx` "reject import with wrong password" (timing-sensitive under full-suite load) → make deterministic (explicit `await`, fake timers or longer bound); confirm green in isolation AND full suite.
- **G3 — Timer determinism audit:** TOTP, clipboard, `useAutoLock` suites — assert every timer path uses `vi.useFakeTimers()`; no real `setTimeout` waits; no `advanceTimersByTimeAsync` misuse.
- **G4 — Lint gate definition:** `npm run lint` must not exceed the approved baseline (~855) at any commit; touched files **0 new**; track baseline deltas in TEST_STATUS.
- **G5 — Evidence:** update TEST_STATUS with per-fix results (isolated + full-suite runs).

**Acceptance:** lint baseline reduced (≥13 fewer problems) with zero new; full `npm run test` fully green (1415/1415) at the end of the program.

### WS-H — Documented feature gaps (credential history + a11y)

- **H1 — Credential history view (TDD):** `lastAccessedAt` is already tracked — add a read-only metadata panel to `CredentialDetailPage`/`CredentialDetailsDialog`.
  - Pure helper `src/presentation/utils/timeFormat` extension or new `formatLastAccessed(cred, now)` (reuses existing `timeFormat.ts` patterns) — tests: relative labels (today/yesterday/N days/months), never-before-accessed state, `undefined` guards.
  - Component tests: renders Created / Updated / Last accessed rows; hidden for missing values.
- **H2 — WCAG 2.1 AA audit (testable fixes first):**
  - Fix audit findings that are assertable in jsdom: dialog focus management (focus trap on open, return focus on close), aria-labels/roles on icon-only buttons, contrast-safe severity colors, keyboard-close on dialogs (Escape).
  - TDD each fix (render + interaction tests) before/with the change.
  - **Automated sweep (optional, requires approval for new devDep):** `axe-core` + `vitest-axe`-style checks on the core dialogs. If not approved, rely on the manual checklist in `docs/security/audit-checklist.md` and record results there.
- **H3 — TOTP SMS fallback (optional/backlog, flagged):** core RFC 6238 TOTP + backup codes are shipped; SMS is a stub with no backend — keep **out of scope** for this program unless explicitly requested (documented here for traceability).

**Acceptance:** H1 shipped with tests; H2 fixes each have a regression test + recorded audit result; H3 explicitly deferred.

### WS-I — Cross-cutting quality (applies to every touched file)

- No `console.log`/`debugger` in new code; no new ESLint problems (`npx eslint <touched files>`).
- Timer-dependent tests use `vi.useFakeTimers()`.
- Deterministic: no network, no real IndexedDB in component tests (mock repos/stores).
- Update `docs/testing/TEST_STATUS.md` with per-task evidence (tests, verification, lint deltas) and this plan's link.

---

## 5. New/Changed File Map

**New — production modules:**
- `src/presentation/pages/securityAuditEngine.ts`
- `src/presentation/pages/credentialFormValidation.ts`
- `src/presentation/hooks/useCredentialForm.ts`
- `src/features/vault/csv/csvExport.ts`, `src/features/vault/csv/csvImport.ts`
- `src/presentation/utils/timeFormat.ts` extension (or `lastAccessedFormat.ts`) — H1

**New — tests (all colocated `__tests__/` unless noted):**
- `securityAuditEngine.test.ts`, `credentialFormValidation.test.ts`, `useCredentialForm.test.ts`
- `csvExport.test.ts`, `csvImport.test.ts`, `lastAccessedFormat.test.ts`
- 35 component test files (WS-C matrix) under `src/presentation/components/__tests__/`
- Page tests (WS-D) under `src/presentation/pages/__tests__/`

**New — E2E (WS-F):**
- `e2e/auth-journey.spec.ts`, `e2e/credential-crud.spec.ts`, `e2e/security-flows.spec.ts`, `e2e/offline-drill.spec.ts`, `e2e/security-audit.spec.ts`, `e2e/fixtures/` helpers

**Changed (refactor only, after tests pass):**
- `SecurityAuditPage.tsx` (WS-A), `AddCredentialPage.tsx`/`EditCredentialPage.tsx` (WS-B), `ExportDialog.tsx`/`ImportDialog.tsx` (WS-E), `CredentialDetailPage.tsx`/`CredentialDetailsDialog.tsx` (WS-H), dialog focus/aria fixes (WS-H)
- Test files fixed under WS-G (13 lint errors, flake, timer determinism)
- Docs: this plan + `docs/testing/TEST_STATUS.md` + `docs/security/audit-checklist.md` (H2 results)

---

## 6. Validation Gates (per task and at end of each workstream)

```bash
npx vitest run <new/affected test files>      # RED confirmation + GREEN pass
npm run type-check                            # 0 errors
npx eslint <touched files>                    # 0 new problems vs. baseline
npx vitest run src/__tests__/integration/     # no regressions on related flows
npm run e2e                                   # WS-F: Playwright (Chromium) green
```

Final gates for the whole program:
- `npm run test` — **1415/1415 passing** (flake G2 eliminated; baseline 1414/1415 + new suites)
- `npm run lint` — total problems ≤ baseline (855) and **strictly fewer** after G1
- `npm run e2e` — all journeys green (Chromium locally; WebKit in CI)
- `npm run type-check` — 0 errors
- Coverage: `npm run test:coverage` thresholds maintained (≥85% lines/statements)

---

## 7. Risks & Notes

- **SecurityAuditPage parity risk (WS-A):** engine port must match current behavior exactly — module tests pin the *existing* rules before rewiring; manual side-by-side score comparison before refactor.
- **Settings/Import/Export jsdom history:** dialog gating previously broke ~15 integration tests; WS-D pins it; WS-E must not reintroduce navigation side effects (no `setTimeout(navigate)`).
- **CSV scope creep:** E1/E2 are the tested core; dialog wiring is minimal and follows existing dialog patterns.
- **E2E flakiness (WS-F):** index users per spec and clear IndexedDB in `beforeEach`; mock the HIBP k-anonymity endpoint in F6; rely on the config's `retries: 2` only in CI, not locally (specs must be deterministic first).
- **Playwright browser install:** running `npm run e2e` locally requires `npx playwright install chromium` if not present (environment step, not a code change).
- **WCAG automation depends on approval:** `axe-core` is a new devDependency — if not approved, H2 proceeds with manual audit + jsdom-assertable regression tests only.
- **Coverage thresholds:** new pure modules are small and dense (help coverage); WS-C/WS-D component/page tests offset page-file line movements.
- **Lint baseline drift:** G4's gate is the mechanism that keeps the program from expanding repo-wide lint debt.
- Keep each workstream's diff small and independent so partial completion still leaves the suite green.

---

## 8. References

- `docs/testing/TESTING_PATTERNS.md` — conventions, fixtures, coverage targets
- `docs/testing/TEST_STATUS.md` — baseline + evidence ledger to update
- `docs/guides/ROADMAP.md` — known gaps (CSV, lint debt, WCAG, TOTP SMS)
- `docs/security/GAP_ANALYSIS.md` §17 — current verified gaps; §11 file-by-file sizes
- `docs/security/audit-checklist.md` — WCAG/manual audit scratchpad (H2)
- `src/MODULE_CONTRACTS.md` — public APIs to preserve during extraction
- `e2e/README.md` + `playwright.config.ts` — E2E conventions, base URL, CI matrix
- `AGENTS.md` — Definition of Done, security guardrails (no logging secrets, `@/` aliases)
