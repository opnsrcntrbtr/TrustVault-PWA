# TrustVault PWA – Agent Operating Charter

## Mission Snapshot
Deliver a zero-knowledge, offline-first password vault with world-class security posture and refined UX. Every agent (human or AI) is accountable for pairing high-value enhancements with measurable verification and updated documentation.

## Core Personas & Responsibilities
| Persona | Primary Scope | Key Inputs | Definition of Ready | Definition of Done |
| --- | --- | --- | --- | --- |
| **Security Architect (Lead: @trustvault-sec)** | Crypto correctness, session lifecycle, WebAuthn, breach detection, export/import encryption, security headers. | `SECURITY.md`, `BREACH_DETECTION_README.md`, `PHASE_4.1_BIOMETRIC_AUTH.md`, OWASP checklist. | Critical bug list reviewed, threat model updated, test plan drafted. | Code merged with unit + security tests, manual verification logged in `SECURITY_AUDIT_REPORT.md`, documentation updated. |
| **UX Director (Lead: @trustvault-ux)** | Credential CRUD UX, password generator, responsive dashboard, onboarding, settings IA, microcopy. | `ROADMAP.md`, `KEY_FINDINGS.md`, user journey maps. | Wireframes or UX notes linked, acceptance criteria and accessibility goals defined. | UI matches spec on desktop/mobile, a11y score ≥ 90, screenshots/GIFs captured, `TEST_STATUS.md` updated. |
| **Automation & Quality Engineer (Lead: @trustvault-qa)** | Vitest suites, integration tests, Lighthouse + PWA audits, CI health, Dexie fixtures. | Test harness docs, `tests/` plans, CI logs. | Test data seeded, mocks ready, success metrics captured. | Tests cover new logic, run in CI, coverage deltas recorded in `TEST_SUMMARY.md`. |
| **Release Captain (Rotates weekly)** | Coordinates feature flags, deployment notes, rollback plans, doc hygiene. | `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_VERIFICATION.md`, release board. | Triage board clean, risk log updated, feature flags mapped. | Release checklist signed, monitoring hooks live, README/ROADMAP refreshed. |

## Operating Rhythm
1. **Intake & Prioritization**
   - Capture ideas/issues in GitHub + `KEY_FINDINGS.md`.
   - Map each to a pillar (Vault Trust, CredOps Experience, Passwordless & Recovery, Threat Intelligence).
   - Security Architect signs off on any feature touching crypto/session flows before implementation.
2. **Design & Plan**
   - UX Director or Security Architect authors mini-brief (context, goals, acceptance, telemetry, rollback).
   - Update `ROADMAP.md` success criteria + tests before coding starts.
3. **Implementation**
   - Follow coding guardrails in `CLAUDE.md` / `.github/copilot-instructions.md`.
   - Pair on risky changes; keep diffs traceable to roadmap items.
4. **Verification**
   - Automation engineer owns test creation; devs own manual smoke.
   - Record results in `TEST_STATUS.md`, `SECURITY_AUDIT_REPORT.md`, and release notes.
5. **Documentation & Handoff**
   - Update README, roadmap, and agent files whenever scope shifts.
   - Release Captain ensures verification artifacts exist before tagging builds.

## Escalation Paths
- **Critical security regression** → Page Security Architect + Release Captain, freeze deploys, log in `SECURITY_AUDIT_REPORT.md` + `KEY_FINDINGS.md`.
- **UX blocking issue** → UX Director triages, attaches repro video, and pairs with implementation owner.
- **Automation failure** → QA lead owns red builds; no merges until CI green.

## Tooling Expectations
- Commands listed in README Verification Matrix are mandatory per feature.
- Lighthouse + `npm audit` run before closing any security-related issue.
- Feature flags documented in `configs/featureFlags.ts` with owner + kill-switch plan.

## Communication Cadence
- **Daily**: Stand-up snippets in project chat (#trustvault-status) referencing roadmap IDs.
- **Weekly**: Release Captain posts summary (done/next/risks/tests) referencing this charter.
- **Post-mortems**: Any incident affecting secrets/session/availability gets a retro added to `SECURITY_AUDIT_REPORT.md`.

Stay synchronized with this charter—shipping high-value enhancements means nothing if verification, docs, or coordination lag behind.
