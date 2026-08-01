# TrustVault PWA

Zero-knowledge credential vault with WebAuthn PRF-backed vault key wrapping (HKDF-SHA256 → AES-256-GCM). Offline-first React 19 PWA with encrypted storage, biometric unlock, and local on-device AI assistance.

> **Status (June 2026):** Production-Ready. All 7 phases complete. Security hardening A-E complete. On-device AI integrated (Gemini Nano, WebLLM, LiteRT-LM).

---

## Why TrustVault
- **Security-first**: Scrypt master hashing, PBKDF2 vault derivation, AES-256-GCM encryption, strict hash-based CSP, non-extractable session vault keys, HSTS/COOP/CORP headers.
- **Offline & cross-platform**: IndexedDB (Dexie) persistence, service worker caching, installable on desktop/mobile.
- **Enterprise UX**: Credential cards, password generator, clipboard hygiene, TOTP, biometric unlock, breach telemetry.
- **Local Intelligence**: On-device AI for password strength explanation and breach impact analysis — zero data egress.

---

## Quick Start
```bash
npm install
npm run dev          # Dev server (http)
npm run dev:https     # Required for WebAuthn or biometric testing
npm run build        # Type-check + production build
npm run test         # Vitest unit/integration suites
```

**Environment:** Node >= 20, npm >= 10. `.env` keys in `docs/guides/GETTING_STARTED.md`.

---

## Documentation Map
| Category | Key Docs |
|---|---|
| **AI Agent Instructions** | `AGENTS.md` (architecture, security, patterns) |
| **Status & Planning** | `docs/status/PROJECT_STATUS.md`, `docs/guides/ROADMAP.md` |
| **Architecture** | `docs/architecture/ARCHITECTURE.md` |
| **Security** | `docs/security/SECURITY.md`, `docs/security/SECURITY_AUDIT_REPORT.md` |
| **Deployment** | `docs/deployment/DEPLOYMENT.md` |
| **Testing** | `docs/testing/TEST_STATUS.md`, `docs/testing/TESTING_PATTERNS.md` |
| **Guides** | `docs/guides/GETTING_STARTED.md`, `docs/guides/quickstart.md` |

Full index: **[INDEX.md](./INDEX.md)**

---

## Contributing
Follow **`AGENTS.md`** guardrails before touching code. Every enhancement needs matching tests + documented verification. Never log or persist secrets; keep vault keys in memory only.

---

**Links:** [Staging](https://trust-vault-pwa.vercel.app) | [GitHub](https://github.com/opnsrcntrbtr/TrustVault-PWA)
