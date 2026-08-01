# TrustVault PWA - AI Agent Instructions

**Security-First Credential Manager** | React 19 + TypeScript 5.7 + Vite 6 + Clean Architecture

---

## AI Agent Instructions → AGENTS.md

All shared AI agent instructions (architecture, security, patterns, conventions) are consolidated in **[AGENTS.md](../AGENTS.md)**. Read it first before making changes.

**Documentation map**: All project docs moved to `docs/` hierarchy:
- Status & planning → `../docs/status/`, `../docs/guides/`
- Architecture → `../docs/architecture/`
- Security & cryptography → `../docs/security/`
- Deployment → `../docs/deployment/`
- Testing → `../docs/testing/`

---

## GitHub Copilot-Specific Patterns

### Code Review
When reviewing PRs:
1. Check crypto operations against `../docs/security/SECURITY.md` patterns
2. Verify no sensitive data in localStorage or console logs
3. Confirm path aliases (`@/`) are used, not relative imports

### PR Templates
When creating pull requests, reference `../docs/guides/ROADMAP.md` for acceptance criteria.

---

## Quick Reference

### Commands
```bash
npm run dev          # HTTP dev server @ :3000
npm run build        # Type-check → Production build
npm test             # Vitest unit tests
```

### Key Files
| Purpose | Path |
|---|---|
| AI instructions | `../AGENTS.md` |
| Architecture | `../docs/architecture/ARCHITECTURE.md` |
| Security | `../docs/security/SECURITY.md` |
| Status | `../docs/status/PROJECT_STATUS.md` |

---

**Last Updated**: 2026-07-06
