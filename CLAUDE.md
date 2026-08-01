# TrustVault PWA - Claude Code Guide

**Tech Stack:** React 19 + Vite 6.4 + TypeScript 5.7 + PWA + IndexedDB (Dexie)
**Architecture:** Clean Architecture (Domain/Data/Presentation) + Offline-First

---

## AI Agent Instructions -> AGENTS.md

All shared AI agent instructions (architecture, security, patterns, conventions) are consolidated in **[AGENTS.md](./AGENTS.md)**. Read it first before making changes.

**Documentation map**: All project docs moved to `docs/` hierarchy:
- Status & planning -> `docs/status/`, `docs/guides/`
- Architecture -> `docs/architecture/`
- Security & cryptography -> `docs/security/`
- Deployment -> `docs/deployment/`
- Testing -> `docs/testing/`

---

## Claude-Specific Session Behavior

### Context Management
- Read 2 files max at a time to avoid context overflow (65k limit)
- Use `grep`/`glob` before reading to locate targets precisely
- Prefer offset/limit reads over whole-file reads

### Graphify Integration
After code changes, run `graphify update .` to keep the knowledge graph current (AST-only, no API cost).

### Token Optimization
Use `rtk` commands for token-efficient bash output:
```bash
rtk gain # Show token savings analytics
rtk discover # Analyze history for missed opportunities
```

---

## Quick Reference

### Commands
```bash
npm run dev # HTTP dev server @ :3000
npm run build # Type-check -> Production build
npm test # Vitest unit tests
```

### Key Files
| Purpose | Path |
|---|---|
| AI instructions | `AGENTS.md` |
| Architecture | `docs/architecture/ARCHITECTURE.md` |
| Security | `docs/security/SECURITY.md` |
| Status | `docs/status/PROJECT_STATUS.md` |
| Roadmap | `docs/guides/ROADMAP.md` |

**Last Updated**: 2026-07-06
