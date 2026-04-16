# TrustVault PWA

Zero-knowledge credential vault engineered for high-assurance teams. Offline-first React 19 PWA with encrypted storage, biometric unlock roadmap, and UX parity with the native Android client.

> **Status (Nov 2025):** Alpha foundation in place, mission now focuses on delivering production-grade security workflows and refined credential experiences.

---

## Why TrustVault
- **Security-first**: Scrypt master hashing, PBKDF2 vault derivation, AES-256-GCM encryption, strict CSP/hardening headers, and Web Crypto–only randomness.
- **Offline & cross-platform**: IndexedDB (Dexie) persistence, service worker caching, installable on desktop/mobile, responsive layout roadmap.
- **Enterprise UX**: Credential cards, password generator, clipboard hygiene, TOTP, biometric unlock, breach telemetry, and encrypted import/export. All enhancement work ships with matching UX polish and instrumentation.

---

## Current Focus — High-Value Enhancements
| Pillar | Goal | Key Deliverables | Validation |
| --- | --- | --- | --- |
| **Vault Trust Hardening** | Fix crypto defects, tighten session lifecycle, and enforce auto-lock + visibility locking. | Vault key decryption patch, secure credential reads, `useAutoLock`, session state clearing, lock UX. | `npm run test -- auth-flow.test.tsx`, manual lock/unlock smoke, IndexedDB inspection. |
| **CredOps Experience** | Ship complete credential CRUD, password generator, clipboard guardrails, TOTP, search/filter, and responsive dashboard. | `AddCredentialPage`, generator dialog, secure clipboard manager, dashboard filters, TOTP integration, responsive cards. | `credential-crud.test.tsx`, UI smoke via Testing Library, Lighthouse Accessibility >90. |
| **Passwordless & Recovery** | WebAuthn biometric unlock plus encrypted import/export and master-password rotation flows. | Biometric enrollment/signin, secure export/import dialogs, re-encryption progress, recovery UX copy. | WebAuthn mocked tests, `import-export.test.tsx`, manual recovery drills. |
| **Threat Intelligence & Reporting** | Breach detection, security audit surfaces, telemetry, and automated test/audit coverage. | HIBP integration, Security Audit dashboard, OWASP checklist automation, >85% Vitest coverage. | `npm run test:coverage`, `npm run lighthouse:security`, SECURITY_AUDIT_REPORT updates. |

Progress for each pillar lives in `ROADMAP.md` with granular prompts, dependencies, and test checklists.

---

## Architecture Snapshot
- **Clean Architecture** with strict dependency flow: `presentation → domain ← data ← core`.
- **React 19 + Vite 6 + TypeScript 5.7** with automatic JSX transform, Suspense-ready route splitting, and strict TS flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **State**: Zustand stores with persistence partialization (never persist vault keys). Auto-lock and biometric layers extend stores via hooks.
- **Storage**: Dexie-backed IndexedDB schemas for credentials, sessions, settings. All sensitive fields encrypted before persistence.
- **Security**: CSP + security headers enforced via Vite middleware + `vercel.json`. WebAuthn, clipboard scrubbing, and audit tooling tracked in roadmap.

---

## Getting Started
```bash
npm install
npm run dev          # Dev server (http)
npm run dev:https     # Required for WebAuthn or biometric testing
npm run build        # Type-check + production build
npm run preview      # Preview production bundle
npm run test         # Vitest unit/integration suites
```

**Environment**
- Node >= 20, npm >= 10
- `.env` keys documented in `PROJECT_OVERVIEW.md` (HIBP, feature toggles)
- `scripts/setup.sh` seeds Dexie schema locally

---

## Verification Matrix
| Check | Command / Tool | Target |
| --- | --- | --- |
| Type safety | `npm run type-check` | Zero errors/warnings |
| Linting | `npm run lint` | 0 warnings, security lint rules on |
| Unit tests | `npm run test` | >85% coverage once Phase 5 lands |
| Integration smoke | `npm run test:integration` | Auth + CRUD + generator + import/export |
| Lighthouse | `npm run lighthouse` | >90 (Perf/Acc/BP/SEO) + 100 PWA |
| Security | `npm run lighthouse:security`, `npm audit` | No critical/high vulns, CSP passes |

Document manual verifications (biometrics, auto-lock, breach triage) in `TEST_STATUS.md` when new features land.

---

## Documentation Map
- `ROADMAP.md` – full phased backlog (critical bugs → production readiness)
- `AGENTS.md` – responsibilities, workflows, and escalation paths for AI + human collaborators
- `CLAUDE.md` / `.github/copilot-instructions.md` – coding guardrails and current objectives
- `SECURITY.md`, `BREACH_DETECTION_README.md`, `PHASE_4.1_BIOMETRIC_AUTH.md` – deep dives for respective pillars
- `PROJECT_SUMMARY.md`, `KEY_FINDINGS.md` – status snapshots and audit deltas

---

## Contributing & Expectations
- Follow the guardrails in `CLAUDE.md` and `.github/copilot-instructions.md` before touching code.
- Every enhancement must land with matching tests plus documented verification steps.
- Never log or persist secrets; keep vault keys, CryptoKey material, and decrypted payloads in memory only.
- Use feature flags (`src/configs/featureFlags.ts`) for experimental UX so production builds remain stable.
- File enhancement notes or risk callouts in `IMPLEMENTATION_STATUS.md` to keep audit history intact.

---

## Support & Links
- **Primary URL:** https://trust-vault-pwa.vercel.app (staging)
- **Issue tracking:** GitHub Issues + `KEY_FINDINGS.md`
- **Security contact:** security@trustvault.app (PGP fingerprint in `SECURITY.md`)
- **Emergency procedure:** Follow `DEPLOYMENT_VERIFICATION.md` and log incidents in `SECURITY_AUDIT_REPORT.md`

Let us know when you land new capabilities so we can update the roadmap and verification docs immediately.
