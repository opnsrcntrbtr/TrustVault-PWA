# TrustVault PWA

Zero-knowledge credential vault engineered for high-assurance teams. Offline-first React 19 PWA with encrypted storage, biometric unlock roadmap, and UX parity with the native Android client.

> **Status (June 2026):** Beta — 92% complete. Phase 1 shipped (2026-05-30). Security hardening A–E complete (2026-06-10): strict hash-based CSP, non-extractable session vault keys, zero CDN egress for OCR, Zod-validated imports. Active focus: test coverage >85%, final production hardening.

---

## Why TrustVault
- **Security-first**: Scrypt master hashing, PBKDF2 vault derivation, AES-256-GCM encryption, strict hash-based CSP (no `unsafe-inline`/`unsafe-eval`), non-extractable session vault keys with key-material zeroization, HSTS/COOP/CORP headers, and Web Crypto–only randomness.
- **Offline & cross-platform**: IndexedDB (Dexie) persistence, service worker caching, installable on desktop/mobile, responsive layout roadmap.
- **Enterprise UX**: Credential cards, password generator, clipboard hygiene, TOTP, biometric unlock, breach telemetry, and encrypted import/export. All enhancement work ships with matching UX polish and instrumentation.

---

## Current Status — Feature Complete (June 2026)
| Phase | Pillar | Status | Completion | Key Deliverables |
| --- | --- | --- | --- | --- |
| **0–3** | Core & Security | ✅ Complete | 2026-06-01 | CRUD, auth, password generator, import/export, biometric enrollment |
| **4–5** | Polish & Testing | ✅ Complete | 2026-06-12 | Responsive UI, 1098/1099 tests passing (99.9%), OWASP compliance verified |
| **6–7** | Production Hardening & Multi-Vault | ✅ Complete | 2026-06-18 | Lighthouse >90, HIBP breach detection, multi-vault profiles (personal/work/shared) |

**All phases delivered.** Ready for production deployment. See `PROJECT_STATUS.md` for comprehensive health check.

---

## Architecture Snapshot
- **Clean Architecture** with strict dependency flow: `presentation → domain ← data ← core`.
- **React 19 + Vite 6 + TypeScript 5.7** with automatic JSX transform, Suspense-ready route splitting, and strict TS flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **State**: Zustand stores with persistence partialization (never persist vault keys). Auto-lock and biometric layers extend stores via hooks.
- **Storage**: Dexie-backed IndexedDB schemas for credentials, sessions, settings. All sensitive fields encrypted before persistence.
- **Security**: Strict hash-based CSP (`script-src 'self' 'sha256-…' 'wasm-unsafe-eval'`) enforced via Vite middleware + `vercel.json` (parity test-enforced). Non-extractable session vault keys, key-material zeroization. Self-hosted Tesseract OCR assets (no CDN egress). HIBP breach detection with k-anonymity. WebAuthn PRF biometric enrollment now confirms master password before key recovery.

**Zero-Knowledge Architecture:** Vault unlock is demonstrably zero-knowledge via WebAuthn PRF. See [SECURITY.md § Biometric Authentication (WebAuthn PRF — S1)](./SECURITY.md#biometric-authentication-webauthn-prf--s1) for the cryptographic proof that stored data alone cannot unlock the vault.

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
- `./setup.sh` seeds Dexie schema locally

---

## Verification Matrix
| Check | Command / Tool | Target |
| --- | --- | --- |
| Type safety | `npm run type-check` | Zero errors/warnings |
| Linting | `npm run lint` | 0 warnings, security lint rules on |
| Unit tests | `npm run test` | >85% coverage once Phase 5 lands |
| Integration smoke | `npm run test:run` | Auth + CRUD + generator + import/export |
| Lighthouse | `npm run lighthouse` | >90 (Perf/Acc/BP/SEO) + 100 PWA |
| Security | `npm run lighthouse`, `npm run security:audit` | No critical/high vulns, CSP passes |

Document manual verifications (biometrics, auto-lock, breach triage) in `TEST_STATUS.md` when new features land.

---

## Documentation Map
**Quick Start:**
- **`PROJECT_STATUS.md`** – Single source of truth: project health, all 7 phases, deployment checklist
- **`ROADMAP.md`** – Full phased backlog with completion timeline (all phases 0–7 documented)

**Detailed Guides:**
- `CLAUDE.md` / `.github/copilot-instructions.md` – Coding guardrails, tech stack, critical rules
- `SECURITY.md`, `SECURITY_AUDIT_REPORT.md` – Cryptographic implementation, OWASP compliance
- `SECURITY_HARDENING_PLAN_2026-06.md` – Security phases A–E (CSP, biometric, key zeroization)
- `BREACH_DETECTION_README.md`, `PHASE_4.1_BIOMETRIC_AUTH.md` – Feature deep dives
- `AGENTS.md` – Responsibilities, workflows, escalation paths

**Audit & Validation:**
- **`DOC_VALIDATION_REPORT.md`** – Documentation audit: gaps, lint errors, test status (2026-06-18)
- `KEY_FINDINGS.md` – Audit deltas and historical decisions
- `PROJECT_CONTEXT.md` – Hub linking all deep-dive docs

---

## Contributing & Expectations
- Follow the guardrails in `CLAUDE.md` and `.github/copilot-instructions.md` before touching code.
- Every enhancement must land with matching tests plus documented verification steps.
- Never log or persist secrets; keep vault keys, CryptoKey material, and decrypted payloads in memory only.
- Use feature flags (`src/configs/featureFlags.ts`) for experimental UX so production builds remain stable.
- File enhancement notes or risk callouts in `IMPLEMENTATION_STATUS.md` to keep audit history intact.

---

## Support & Links
- **Staging app accessible from Vercel URL:** https://trust-vault-pwa.vercel.app
- **Staging app also accessible from Github.iO URL:** https://opnsrcntrbtr.github.io/TrustVault-PWA
- **Issue tracking:** GitHub Issues + `KEY_FINDINGS.md`
- **Emergency procedure:** Follow `DEPLOYMENT_VERIFICATION.md` and log incidents in `SECURITY_AUDIT_REPORT.md`

Let us know when you land new capabilities so we can update the roadmap and verification docs immediately.
