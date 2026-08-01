# TrustVault PWA

Zero-knowledge credential vault engineered engineered with State of the Art WebAuthn PRF-backed vault key wrapping (HKDF-SHA256 → AES-256-GCM). Offline-first React 19 PWA with encrypted storage, biometric unlock, and local on-device AI assistance.

A stored record dump alone can never reconstruct your vault key. The wrap key is derived from the authenticator's PRF (hmac-secret) output — produced by hardware only after user verification (biometric/PIN) and never persisted — or from a master password via memory-hard scrypt. 

The production-proven TrustVault-PWA security engine; implements [webauthn-prf-zktv](https://github.com/ghopnsrcntrbtr/webauthn-prf-zktv) npm package which is also the reference implementation for the accompanying research paper [WebAuthn PRF-Based Vault Key Wrapping and Zero-Knowledge PWA Storage Architecture](https://doi.org/10.6084/m9.figshare.32915411)

> **Status (June 2026):** Production-Ready. All 7 development phases complete. Security hardening A–E complete. On-device AI assistance integrated (Gemini Nano, WebLLM, LiteRT-LM). Ready for production deployment.

---

## Why TrustVault
- **Security-first**: Scrypt master hashing, PBKDF2 vault derivation, AES-256-GCM encryption, strict hash-based CSP (no `unsafe-inline`/`unsafe-eval`), non-extractable session vault keys with key-material zeroization, HSTS/COOP/CORP headers, and Web Crypto–only randomness.
- **Offline & cross-platform**: IndexedDB (Dexie) persistence, service worker caching, installable on desktop/mobile, responsive layout.
- **Enterprise UX**: Credential cards, password generator, clipboard hygiene, TOTP, biometric unlock, breach telemetry, and encrypted import/export.
- **Local Intelligence**: On-device AI for password strength explanation and breach impact analysis — zero data egress, fully local inference.

---

## Current Status — Feature Complete (June 2026)
| Phase | Pillar | Status | Completion | Key Deliverables |
| --- | --- | --- | --- | --- |
| **0–3** | Core & Security | ✅ Complete | 2026-06-01 | CRUD, auth, password generator, import/export, biometric enrollment |
| **4–5** | Polish & Testing | ✅ Complete | 2026-06-12 | Responsive UI, 4139 tests running (3 integration failures on main), OWASP compliance verified |
| **6–7** | Production Hardening & Multi-Vault | ✅ Complete | 2026-06-18 | Lighthouse >90, HIBP breach detection, multi-vault profiles (personal/work/shared) |
| **Extra** | On-Device AI | ✅ Complete | 2026-06-21 | Local inference (Gemini Nano, WebLLM, LiteRT-LM), strength/breach AI explains |

**All phases delivered.** Ready for production deployment. See `PROJECT_STATUS.md` for comprehensive health check.

---

## Architecture Snapshot
- **Clean Architecture** with strict dependency flow: `presentation → domain ← data ← core`.
- **React 19 + Vite 6 + TypeScript 5.7** with automatic JSX transform, Suspense-ready route splitting, and strict TS flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **State**: Zustand stores with persistence partialization (never persist vault keys). Auto-lock and biometric layers extend stores via hooks.
- **Storage**: Dexie-backed IndexedDB schemas for credentials, sessions, settings. All sensitive fields encrypted before persistence.
- **Security**: Strict hash-based CSP (`script-src 'self' 'sha256-…' 'wasm-unsafe-eval'`) enforced via Vite middleware + `vercel.json` (parity test-enforced). Non-extractable session vault keys, key-material zeroization. Self-hosted Tesseract OCR assets (no CDN egress). HIBP breach detection with k-anonymity. WebAuthn PRF biometric enrollment now confirms master password before key recovery.
- **AI Boundary**: Fully local inference using a provider abstraction. Prefers Chrome built-in (Gemini Nano) on desktop, and fallbacks to WebLLM or LiteRT-LM on Android (WebGPU). No prompt/response data ever leaves the device.

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
| Unit tests | `npm run test` | >85% coverage |
| Integration smoke | `npm run test:run` | Auth + CRUD + generator + import/export |
| Lighthouse | `npm run lighthouse` | >90 (Perf/Acc/BP/SEO) + 100 PWA |
| Security | `npm run lighthouse`, `npm run security:audit` | No critical/high vulns, CSP passes |

Document manual verifications (biometrics, auto-lock, breach triage) in `TEST_STATUS.md` when new features land.

---

## Documentation Map
**AI Agent Instructions:**
- **`AGENTS.md`** – Single source of truth: architecture, security patterns, conventions for all AI coding agents

**Quick Start:**
- **`docs/status/PROJECT_STATUS.md`** – Project health, all 7 phases, deployment checklist
- **`docs/guides/ROADMAP.md`** – Full phased backlog with completion timeline (all phases 0-7 documented)
- **`docs/guides/GETTING_STARTED.md`** – Setup guide, first login, troubleshooting

**Architecture & Security:**
- **`docs/architecture/ARCHITECTURE.md`** – Clean Architecture layering, module contracts
- **`docs/security/SECURITY.md`** – Cryptographic implementation, OWASP compliance
- **`docs/security/GAP_ANALYSIS.md`** – Historical gap analysis (sections 1–16 superseded by §17)
- **`docs/security/SECURITY_AUDIT_REPORT.md`** – Security audit findings and remediation

**Deployment & Testing:**
- **`docs/deployment/DEPLOYMENT.md`** – Vercel deployment, CI/CD, verification
- **`docs/testing/TEST_STATUS.md`** – Test coverage, manual verification evidence

**Historical & Reference:**
- `DOC_VALIDATION_REPORT.md` – Documentation audit: gaps, lint errors (2026-06-18)
- `KEY_FINDINGS.md` – Historical audit deltas and resolutions
- `PROJECT_CONTEXT.md` – Hub linking all feature deep-dives

---

## Contributing & Expectations
- Follow the guardrails in **`AGENTS.md`** (consolidated AI agent instructions) before touching code.
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
