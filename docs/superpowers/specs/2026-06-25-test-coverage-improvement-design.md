# Test Coverage Improvement — Master Plan

**Date:** 2026-06-25
**Status:** Approved for implementation planning

## Goal

Close test coverage gaps prioritized by **security impact** and **unblocking future work**,
not raw percentage. Baseline: 1261/1268 tests passing (99.4%), 94 test files. ~40 source
modules currently have no test file.

## Approach

**Tiering logic (blended):** Tier 1 = security-critical core logic regardless of dependency
direction → Tier 2 = hooks/utils wrapping Tier 1 or otherwise low-risk but cheap to cover →
Tier 3 = pages/dialogs, explicitly deprioritized for new unit tests.

**Coverage depth:** Focused, not exhaustive. ~20-40 tests per module — happy path + the
security-relevant edge cases (rate limiting, retry/backoff, malformed input, boundary
conditions on severity/strength scoring). Not aiming for gold-plated coverage on any single
module.

**Page/dialog rationale (Tier 3 deprioritization):** Pages and dialogs are UI-integration
heavy, brittle as isolated unit tests, and lower ROI than the project's existing
`src/__tests__/integration/` suite, which already exercises several of them end-to-end. New
unit tests for Tier 3 are out of scope for this plan; if integration coverage gaps are found
there later, they get their own spec.

## Tier 1 — Security-Critical Core Logic

| Module | Lines | Why |
|---|---|---|
| `src/core/breach/hibpService.ts` | 450 | k-anonymity password/email breach checks, rate limiting (serialized gate + exponential backoff), in-memory cache with TTL, severity banding. Directly handles password hash prefixes against an external API. |
| `src/core/auth/rateLimiter.ts` | 72 | Login lockout / brute-force defense, consumed by `UserRepositoryImpl`. |
| `src/features/vault/generator/passwordGenerator.ts` | 284 | Generates the actual secrets users store in the vault. |
| `src/features/vault/generator/passphraseGenerator.ts` | 241 | Same — secret generation, different algorithm. |
| `src/features/vault/generator/strengthAnalyzer.ts` | 312 | Drives the security feedback (strength score/label) users rely on to judge their own secrets. |
| `src/core/ocr/credentialParser.ts` | 291 | Parses OCR'd text into credential fields — a parsing bug silently saves the wrong password/username. |

**Test focus per module:**
- `hibpService.ts`: cache hit/miss/expiry, rate-limit serialization under concurrent calls,
  429 exponential backoff + retry-count escalation, 404 "safe" short-circuit, severity band
  boundaries (0 / <1k / 1k-10k / 10k-100k / >100k), email breach filtering
  (`isVerified`/`includeUnverified`), missing API key disables email check gracefully,
  `isHibpEnabled()` env parsing.
- `rateLimiter.ts`: lockout threshold trigger, backoff escalation, reset after window expiry,
  successful login clears state.
- `passwordGenerator.ts` / `passphraseGenerator.ts`: option matrix (length, charset toggles),
  uniqueness across repeated calls, minimum entropy guarantees, edge values (min/max length).
- `strengthAnalyzer.ts`: boundary scores between strength bands, repeated-character penalty,
  common-password detection if present, empty/very-short input.
- `credentialParser.ts`: well-formed OCR text → correct field extraction, malformed/partial
  text → graceful fallback (no throw, no silent wrong-field assignment), ambiguous field
  ordering.

**Estimated:** ~25-30 tests × 6 modules ≈ 150-180 tests.

## Tier 2 — Hooks/Utils (lower risk, cheap coverage)

| Module | Lines | Notes |
|---|---|---|
| `src/hooks/useDriverTour.ts` | 463 | localStorage-backed tour state + driver.js wiring — mock `driver.js` and `localStorage`. |
| `src/presentation/utils/performance.ts` | 283 | Generic debounce/measure utilities, no security relevance, fast to test. |
| `src/core/ocr/tesseractService.ts` | 168 | Lazy-loaded Tesseract worker wrapper — mock the worker; verify init/cleanup/buffer-clearing contract, not OCR accuracy. |
| `src/core/ocr/cameraCapture.ts` | 160 | `MediaDevices`/`ImageCapture` wrapper — mock browser APIs; verify stream lifecycle and explicit image-data clearing (stated security property in the file's own header comment). |

**Estimated:** ~15-20 tests × 4 modules ≈ 60-80 tests.

## Tier 3 — Pages/Dialogs (out of scope for this plan)

Explicitly not covered by new unit tests in this effort: `EditCredentialPage.tsx`,
`DashboardPage.tsx`, `SecurityAuditPage.tsx`, `AddCredentialPage.tsx`,
`CredentialDetailsDialog.tsx`, `SettingsPage.tsx`, and other page/dialog components
identified as untested. These remain candidates for the existing integration-test suite,
not this plan.

## Out of Scope

- `src/data/storage/database.ts` — mostly Dexie schema/migration config; already exercised
  indirectly through `CredentialRepositoryImpl.test.ts` / `UserRepositoryImpl.test.ts`. Not
  worth isolated unit tests under the "focused coverage" goal.
- Any new integration tests (separate effort, separate spec if pursued).
- Raising the existing 7 known-failing tests' pass rate (separate, already-tracked issue per
  `TEST_STATUS.md`).

## Execution

Implemented as a phased plan: one module (or tightly related pair, e.g. the two generators)
per implementation step, each following TDD (failing test first), each independently
verifiable via `npm run test -- <file>`, `npm run type-check`, `npm run lint` on touched
files. Tier 1 modules first, in the table order above (breach detection and rate limiting
before generators, since they're smaller/faster wins that also unblock confidence in the
security-boundary story); Tier 2 after Tier 1 is complete.
