# TDD Improvement Plan — Presentation Components & Pages

**Date:** 2026-08-02
**Status:** Planned (awaiting approval; execution happens in later sessions, one workstream at a time)
**Program type:** Mixed — targeted refactoring + new test coverage + one documented feature, every change driven by Test-Driven Development (red → green → refactor)
**Target areas:** `src/presentation/pages/**` and `src/presentation/components/**`

---

## 1. Context & Baseline

TrustVault PWA is feature-complete (7 phases + AI; **1414/1415 tests passing, 119 files** per `docs/testing/TEST_STATUS.md`). This plan targets the **presentation layer**, where quality varies:

| Area | Current state |
|---|---|
| `SecurityAuditPage.tsx` | ~470 lines; the **entire security-issue detection engine** (`analyzeCredentials`, score, weak/reused/old/no-password/breached rules, `issuesByType`) lives inside the component. **No direct unit test file** — only manual verification recorded. Highest-value extraction target. |
| `AddCredentialPage.tsx` / `EditCredentialPage.tsx` | **610 / 733-line monoliths** (per `docs/security/GAP_ANALYSIS.md` §11) with duplicated form/validation logic. No direct tests; covered only indirectly by `src/__tests__/integration/credential-crud.test.tsx`. |
| `DashboardPage.tsx` / `FavoritesPage.tsx` | Stats + filtering logic inline; no direct page tests (integration covers dedup/sort). |
| Components | 48 components in `src/presentation/components/`; **~30 have zero direct test files** (e.g. `CredentialCard`, `TotpDisplay`, `SearchBar`, `FilterChips`, `TagInput`, `CredentialDetailsDialog`, `SwipeableCredentialCard`, `DeleteConfirmDialog`, `ThemeToggle`, `OfflineIndicator`, `MobileNavigation`, `ProfileSwitcher`, `InstallPrompt`, `RouteErrorBoundary`, `CryptoAPIError`). |
| Documented gap | **CSV import/export** not implemented (ROADMAP known gaps; GAP_ANALYSIS §17 #6). Purely additive, ideal for TDD. |

**Coverage targets (from `docs/testing/TESTING_PATTERNS.md`):** components ≥70%, overall ≥80%. Pages are currently validated mostly via the integration suite; this plan adds focused unit coverage without regressing integration confidence.

---

## 2. Goals & Non-Goals

### Goals
1. Move security-critical, business logic **out of components into pure, unit-tested modules** (testable without DOM/jsdom).
2. Add direct component/page test coverage for the highest-value untested surfaces.
3. Ship the documented **CSV import/export** feature with tests written before implementation.
4. Keep every change verified by: failing test first → minimal green implementation → safe refactor → full validation battery.

### Non-Goals
- No changes to crypto/auth/breach **core** modules (already ≥90% covered; out of scope for this program).
- No full rewrite of pages — decomposition only where it enables testing or removes duplication.
- No new runtime dependencies. Test-only additions are allowed only if already present in `devDependencies` (Vitest, RTL, fake-indexeddb, jest-dom).
- Not fixing the entire repo-wide lint baseline (~855 pre-existing problems); only **0 new** issues on touched files.

---

## 3. TDD Workflow (repo-specific)

Every task follows this loop, committed to `docs/testing/TEST_STATUS.md` per the AGENTS.md convention:

1. **RED** — write the failing test(s) in a colocated `__tests__/` file (`src/presentation/**/__tests__/*.test.ts(x)`). Run: `npx vitest run <new test file>` → confirm failure is for the right reason.
2. **GREEN** — write the minimal production code (new pure module, hook, or component) to pass.
3. **REFACTOR** — rewire the existing component/page to consume the new module. Re-run tests → still green.
4. **VALIDATE** — see §7. Record evidence in `docs/testing/TEST_STATUS.md`.

Test conventions (per `TESTING_PATTERNS.md`): use `@/` aliases, fixtures from `src/__tests__/fixtures/` where they exist, `describe`/`it`, `vi.fn()`, `@testing-library/react` for components, `vi.useFakeTimers()` for time logic, no `console.log`.

---

## 4. Workstreams & Tasks

> Order = value/risk. Workstreams are independent; execute in any order, but finish one task (incl. validation) before starting the next.

### WS-A — Extract & test Security Audit logic (highest value)

Extract the issue-detection engine from `SecurityAuditPage.tsx` into a pure module; page becomes a thin view.

**A1 — Pure module `securityAuditEngine` (TDD, no DOM)**
- New file: `src/presentation/pages/securityAuditEngine.ts` (or `src/features/audit/securityAudit.ts`).
- Export: `buildSecurityIssues(credentials, breachedCredentials, opts?) → SecurityIssue[]`, `computeSecurityScore(credentials) → number`, `countIssuesByType(issues) → issuesByType`, `formatAgeDays(updatedAt, now) → number | undefined`.
- Port the exact rules from `analyzeCredentials()` (breach-priority, missing-password, weak `<60`/`<40` severity bands, reused via password map, old `>365`/`>730`, plain-avg score matching DashboardPage).
- New tests `__tests__/securityAuditEngine.test.ts`: at minimum — each issue type fires (weak/reused/old/no-password/breached), severity bands (40/60 boundaries), breach outranks weak for same credential, reused aggregation, empty vault → score 0 + no issues, age boundary days, `issuesByType` counts.
- Refactor: `SecurityAuditPage` calls the module; delete the inline logic. Keep UI identical.

**A2 — Score/label presentation helpers (TDD)**
- Extract `getScoreColor`, `getScoreLabel`, `getSeverityColor`, `getSeverityIcon` into `securityAuditEngine.ts` (icon stays in the page; color/label/severity-mapping become pure).
- Tests: boundary labels (80/60/40), color mapping, severity color/icon mapping.
- Refactor page to consume.

**Acceptance:** all A1–A2 tests pass; `SecurityAuditPage` renders identically (covered by existing integration/manual flows); no new lint issues.

### WS-B — Decompose Add/Edit credential monoliths

**B1 — Pure credential-form validation (TDD)**
- New file: `src/presentation/pages/credentialFormValidation.ts` with `validateCredentialForm(input) → { valid, errors: { title?, username?, password?, url? } }` (URL via `src/presentation/utils/url.ts`, password min-length 12 rule parity with signup, tag cap).
- Tests: each field rule, valid form, boundary cases (empty title, bad URL, short password).
- Refactor: `AddCredentialPage`/`EditCredentialPage` call it.

**B2 — Shared `useCredentialForm` hook (TDD)**
- New hook `src/presentation/hooks/useCredentialForm.ts`: owns form state, change handlers, validation on submit, dirty tracking, initial-value seeding (edit mode).
- Tests via `renderHook`: initial values, edits update state, submit runs `onSave` only when valid, validation errors surface, seed/update for edit mode.
- Refactor: both pages consume the hook (removes the largest duplicated chunk of the 610/733-line files).

**Acceptance:** B1–B2 green; Add/Edit flows still pass `credential-crud.test.tsx` integration; pages shrink without behavior change.

### WS-C — Direct coverage for untested high-value components

Write component tests for the following (colocate under `src/presentation/components/__tests__/`; mock stores/services, never real crypto/DB):

| Component | Minimum cases |
|---|---|
| `CredentialCard` | renders title/username/breach badge; menu actions (edit/favorite/delete) fire callbacks; no crash on empty credential |
| `TotpDisplay` | renders 6-digit code, formatting of seconds-left (fake timers), error/empty states |
| `SearchBar` | typing calls `onChange`, debounce behavior (fake timers), clear button |
| `FilterChips` | active-chip highlight, callback with category, all-chip reset |
| `TagInput` | add tag on Enter, comma-separated add, duplicate rejection, remove tag |
| `CredentialDetailsDialog` | renders fields, copy buttons call handlers, favorite toggle, close |
| `DeleteConfirmDialog` | confirm/cancel callbacks, loading disables confirm, title shown |
| `SwipeableCredentialCard` | swipe gestures map to reveal actions (use `useSwipeGesture` mock) |
| `ThemeToggle` | toggles store theme, icon changes |
| `OfflineIndicator` | renders when offline (navigator.onLine mock), hidden online |
| `MobileNavigation` | renders nav items, active route highlight |
| `ProfileSwitcher` | lists profiles, selection calls store |
| `InstallPrompt` | hidden when criteria unmet; fires install when `beforeinstallprompt` captured |
| `RouteErrorBoundary` | catches child error → fallback UI + retry (existing `ErrorBoundary.test.tsx` as template) |
| `CryptoAPIError` | renders guidance when crypto API missing |

**Acceptance:** each component's tests pass; components are unchanged or only refactored for testability (e.g. prop-drilling instead of store reads where trivial).

### WS-D — Page-level behavior tests (focused, not full-render)

For pages already covered by integration tests, add **targeted** unit tests that mount the page with mocked stores/repos and assert behavior (avoids duplicating the integration suite's happy paths):

- `DashboardPage`: stats derive from mocked credential list; search filters; category filter; empty state.
- `FavoritesPage`: only favorites render; empty state.
- `CredentialDetailPage`: loading → rendered; missing credential → error + back action; edit navigates; delete confirm path calls repo.
- `SecurityAuditPage`: after WS-A, a smoke test that the page renders the engine output (score circle, issue list) with a mocked engine.
- `SettingsPage`: renders sections; dialog open/close gating (the historical jsdom mis-click area — pin it).

**Acceptance:** all pass; no `.skip` added; `src/__tests__/integration/` still green (no overlapping/contradicting assertions).

### WS-E — New feature: CSV import/export (TDD)

The documented gap (GAP_ANALYSIS §17 #6, ROADMAP known gaps).

- **E1** `src/features/vault/csv/csvExport.ts` — `serializeCredentialsCsv(credentials) → string` (RFC 4180 quoting, header row, category/tags encoding).
- **E2** `src/features/vault/csv/csvImport.ts` — `parseCredentialsCsv(text) → { rows, errors }` (quoted fields, newlines in fields, header detection, row validation with Zod-like field rules; **never** produces plaintext passwords into logs).
- Tests (E1+E2): round-trip export→parse, quoting edge cases (commas, quotes, newlines, UTF-8), malformed row error reporting, empty input, header variants.
- Refactor/wire: add "CSV" format option to `ExportDialog` (download via Blob) and "CSV" accept to `ImportDialog` (parse → map to credential inputs → existing validation). Dialog wiring is the only DOM-touching part; keep dialogs' existing tests (integration) green.

**Acceptance:** E1/E2 fully unit-tested before any dialog wiring; manual verify one export→import round trip and record in TEST_STATUS.md.

### WS-F — Cross-cutting quality (on touched files only)

- No `console.log`/`debugger` in new code; no new ESLint problems (`npx eslint <touched files>`).
- Timer-dependent tests use `vi.useFakeTimers()` (no real `setTimeout` waits).
- Deterministic, no network, no real IndexedDB in component tests (mock repos/stores).
- Update `docs/testing/TEST_STATUS.md` with per-task evidence (tests, verification, lint deltas) and this plan's link.

---

## 5. New/Changed File Map

**New:**
- `src/presentation/pages/securityAuditEngine.ts` (+ `__tests__/securityAuditEngine.test.ts`)
- `src/presentation/pages/credentialFormValidation.ts` (+ `__tests__/credentialFormValidation.test.ts`)
- `src/presentation/hooks/useCredentialForm.ts` (+ `__tests__/useCredentialForm.test.ts`)
- `src/features/vault/csv/csvExport.ts`, `src/features/vault/csv/csvImport.ts` (+ `__tests__/csvExport.test.ts`, `csvImport.test.ts`)
- Component tests under `src/presentation/components/__tests__/` (WS-C list)
- Page tests under `src/presentation/pages/__tests__/` (WS-D list)
- This plan + `docs/testing/TEST_STATUS.md` updates

**Changed (refactor only, after tests pass):**
- `SecurityAuditPage.tsx`, `AddCredentialPage.tsx`, `EditCredentialPage.tsx`, `ExportDialog.tsx`, `ImportDialog.tsx` (CSV wiring)

---

## 6. Validation Gates (per task and at end of each workstream)

```bash
npx vitest run <new/affected test files>      # RED confirmation + GREEN pass
npm run type-check                            # 0 errors
npx eslint <touched files>                    # 0 new problems vs. baseline
npx vitest run src/__tests__/integration/     # no regressions on related flows
```

Final gate for the whole program: `npm run test` (full suite) with **no regressions** (baseline: 1414/1415; the single known flake is `import-export.test.tsx` wrong-password timing case, confirmed passing in isolation).

---

## 7. Risks & Notes

- **SecurityAuditPage parity risk** (WS-A): the engine port must match current behavior exactly — this is why the module tests pin the *existing* rules before the page is rewired. Compare scores/issues against the page before refactor in a manual check.
- **Settings/Import/Export jsdom history**: dialog gating previously broke ~15 integration tests; WS-D pins it and WS-E must not reintroduce navigation side effects (no `setTimeout(navigate)` patterns).
- **CSV scope creep**: E1/E2 are the tested core; dialog wiring is minimal and follows existing Import/ExportDialog patterns.
- **Coverage thresholds**: `npm run test:coverage` enforces lines/statements ≥85% repo-wide — new pure modules are small and dense, so they help; WS-C component tests should offset any page-file line movements.
- Keep each workstream's diff small and independent so partial completion still leaves the suite green.

---

## 8. References

- `docs/testing/TESTING_PATTERNS.md` — conventions, fixtures, coverage targets
- `docs/testing/TEST_STATUS.md` — baseline + evidence ledger to update
- `docs/guides/ROADMAP.md` — known gaps (CSV, lint debt, WCAG)
- `docs/security/GAP_ANALYSIS.md` §17 — current verified gaps; §11 file-by-file sizes
- `src/MODULE_CONTRACTS.md` — public APIs to preserve during extraction
- `AGENTS.md` — Definition of Done, security guardrails (no logging secrets, `@/` aliases)
