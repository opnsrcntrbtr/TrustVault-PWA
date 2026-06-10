# TrustVault PWA - Agentic Coding Guide

This file is the primary operating guide for Codex and similar agentic AI coding systems working in TrustVault PWA. Treat `CLAUDE.md` as the deeper implementation reference and keep this file focused on shared agent behavior, verification, and handoff discipline.

## Mission Snapshot

Deliver a zero-knowledge, offline-first password vault with a world-class security posture and refined UX. Every agent must pair code changes with measurable verification, documentation updates when scope changes, and careful handling of secrets.

## Agent Operating Rules

- Read repo context before changing files: start with `graphify` guidance below, then inspect the smallest relevant set of files.
- Prefer `rg`/`rg --files` for search, follow existing architecture and local patterns, and keep diffs scoped to the user request.
- Never log, expose, persist, or serialize master passwords, vault keys, decrypted payloads, CryptoKey material, session secrets, or biometric PRF-derived material.
- Do not revert or overwrite user changes unless the user explicitly asks. If unrelated local changes exist, leave them alone.
- Preserve the offline-first posture: database, service worker, network, OCR, breach detection, and auth failures must degrade gracefully.
- Keep risky or experimental behavior feature-flagged or clearly guarded, with owner and rollback notes when applicable.
- Update `README.md`, `ROADMAP.md`, `TEST_STATUS.md`, `SECURITY_AUDIT_REPORT.md`, `CLAUDE.md`, or this file when scope, validation, ownership, or workflows change.

## CLAUDE.md Reference

Before implementing, review `CLAUDE.md` for the concrete guardrails that apply to this repo:

- React 19 StrictMode-safe effects, cleanup, mounted flags, and timeout fallbacks.
- Offline-first Dexie initialization and graceful persistence failure behavior.
- TypeScript strict-mode expectations, including null-safe access and explicit returns.
- `@/` path aliases and Clean Architecture dependency boundaries.
- Security headers managed through `src/config/securityHeaders.ts`, not inline meta tags or duplicated config.
- PWA icon, service worker, Lighthouse, and performance expectations.
- Zustand state handling, vault-key memory hygiene, crypto rules, and lazy loading of heavy WASM/UMD modules.

If `AGENTS.md` and `CLAUDE.md` disagree on implementation details, prefer `CLAUDE.md` for code-level rules and update the stale document as part of the same change when appropriate.

## Responsibility Lenses

Use these lenses to catch the right risks while planning and reviewing work:

| Lens | What to Protect | Required Evidence |
| --- | --- | --- |
| Security | Crypto correctness, session lifecycle, WebAuthn, breach detection, import/export encryption, security headers. | Unit/security tests, `npm run security:audit` when relevant, and notes in `SECURITY_AUDIT_REPORT.md` for security changes. |
| UX | Credential CRUD, password generator, responsive dashboard, onboarding, settings IA, accessibility, microcopy. | Desktop/mobile manual checks, accessibility review, screenshots/GIFs when useful, and `TEST_STATUS.md` updates for new UX. |
| QA | Vitest coverage, integration smoke, Lighthouse/PWA checks, CI health, Dexie fixtures. | Targeted tests, coverage or smoke notes, and exact commands/results recorded in the handoff. |
| Release | Feature flags, deployment notes, rollback paths, doc hygiene, release readiness. | Updated docs, risk notes, feature-flag ownership, and verification artifacts before tagging or merging. |

## Verification Expectations

Run the narrowest command set that proves the change, then report what passed and what was skipped.

| Change Type | Expected Commands |
| --- | --- |
| TypeScript or shared logic | `npm run type-check`, targeted `npm run test` or `npm run test:run` |
| UI or React behavior | `npm run type-check`, `npm run lint`, targeted `npm run test`, manual browser check when relevant |
| Security-sensitive behavior | `npm run type-check`, targeted tests, `npm run security:audit`, `npm run lighthouse` when headers/PWA behavior are affected |
| Documentation-only | Manual Markdown review, `npm run docs:verify` when applicable |

The README Verification Matrix remains the project-level baseline. Record manual verification in `TEST_STATUS.md`, and use `SECURITY_AUDIT_REPORT.md` for changes affecting secrets, sessions, crypto, CSP, biometrics, import/export, or breach detection.

## Documentation & Handoff

- Keep handoffs concise but concrete: files changed, commands run, results, and any residual risk.
- Link work back to `ROADMAP.md` or `KEY_FINDINGS.md` when it advances a tracked item.
- Do not mark security or UX work done without matching verification evidence.
- If a change introduces a new workflow, dependency, feature flag, or operational expectation, update the relevant docs in the same branch.

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read `graphify-out/GRAPH_REPORT.md` before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF `graphify-out/wiki/index.md` EXISTS, navigate it instead of reading raw files.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep; these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
