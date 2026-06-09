# TrustVault PWA

Zero-knowledge credential vault engineered for high-assurance teams. Offline-first React 19 PWA with encrypted storage, biometric unlock roadmap, and UX parity with the native Android client.

> **Status (June 2026):** Beta — 92% complete. Phase 1 shipped (2026-05-30). Security hardening A–E complete (2026-06-10): strict hash-based CSP, non-extractable session vault keys, zero CDN egress for OCR, Zod-validated imports. Active focus: test coverage >85%, final production hardening.

---

## Why TrustVault
- **Security-first**: Scrypt master hashing, PBKDF2 vault derivation, AES-256-GCM encryption, strict hash-based CSP (no `unsafe-inline`/`unsafe-eval`), non-extractable session vault keys with key-material zeroization, HSTS/COOP/CORP headers, and Web Crypto–only randomness.
- **Offline & cross-platform**: IndexedDB (Dexie) persistence, service worker caching, installable on desktop/mobile, responsive layout roadmap.
- **Enterprise UX**: Credential cards, password generator, clipboard hygiene, TOTP, biometric unlock, breach telemetry, and encrypted import/export. All enhancement work ships with matching UX polish and instrumentation.

---

## Current Focus — Production Hardening (June 2026)
| Pillar | Status | Delivered | Next |
| --- | --- | --- | --- |
| **Vault Trust Hardening** | ✅ Complete | Strict hash-based CSP (S2), non-extractable session keys + zeroization (S7), Zod import validation (S8), HSTS/COOP/CORP (S6), scrypt N=2^17 (S4), metadata encryption (S5) | — |
| **Passwordless Auth** | ✅ Complete | WebAuthn PRF zero-knowledge biometric unlock (S1), master-password enrollment gate, DB v7 migration, fallback to password for non-PRF devices | — |
| **CredOps Experience** | ✅ Complete | Full CRUD (Add/Edit/Detail), password generator, clipboard hygiene, TOTP, search/filter, responsive dashboard, encrypted `.tvault` import/export | Minor TOTP edge cases |
| **Threat Intelligence** | ✅ Complete | HIBP breach detection with k-anonymity (user-toggleable), self-hosted Tesseract OCR (no CDN egress, P2), security audit dashboard | — |
| **Test Coverage** | 🟡 In Progress | 207/208 touched-suite tests passing; real ZK invariant in `integration.test.ts` | Reach >85% overall coverage |

Progress for each pillar lives in `ROADMAP.md` with granular prompts, dependencies, and test checklists.

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
- `SECURITY.md`, `SECURITY_AUDIT_REPORT.md`, `SECURITY_PWA_ENHANCEMENT_PLAN.md` – security posture, audit history, and enhancement tracking
- `SECURITY_HARDENING_PLAN_2026-06.md` – June 2026 hardening plan (S2/S7/S8/P2/P5 phases A–E)
- `BREACH_DETECTION_README.md`, `PHASE_4.1_BIOMETRIC_AUTH.md` – feature deep dives
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
- **Staging app accessible from Vercel URL:** https://trust-vault-pwa.vercel.app
- **Staging app also accessible from Github.iO URL:** https://opnsrcntrbtr.github.io/TrustVault-PWA
- **Issue tracking:** GitHub Issues + `KEY_FINDINGS.md`
- **Emergency procedure:** Follow `DEPLOYMENT_VERIFICATION.md` and log incidents in `SECURITY_AUDIT_REPORT.md`

Let us know when you land new capabilities so we can update the roadmap and verification docs immediately.
