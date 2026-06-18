# TrustVault PWA: AI-Assisted Development File Reorganization

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Reorganize the TrustVault PWA codebase to enable seamless multi-agent AI development ("vibe coding") through explicit module contracts, unified test organization, documentation, and AI tool configuration — while preserving existing Clean Architecture, security patterns, and offline-first PWA principles.

**Architecture:** 
- **Hybrid approach**: Keep familiar Clean Architecture layers (domain/data/presentation/core) but add explicit **module entry points** via `index.ts` and **contract documentation** via `README.md` in each module
- **Consolidated test organization**: Move to colocated pattern using `.test.ts`/`.test.tsx` suffixes (Vitest-native), consolidate test utilities in `src/test/`
- **AI tool configuration**: Create `.aider.conf.json`, `.codeium.json`, `.cursor.conf.json` to teach agents about dependency constraints, forbidden patterns, and test conventions
- **Three-tier documentation**: Module-level README (public API), codebase-level ARCHITECTURE.md (layer structure), and dev guidelines (DEVELOPMENT.md)

**Tech Stack:** React 19, Vite 6.4, TypeScript 5.7, Vitest, Dexie, Zustand, Clean Architecture

## Global Constraints

- **Node:** ≥20.0.0 | **NPM:** ≥10.0.0
- **Path aliases:** Use `@/` consistently (tsconfig already configured)
- **Security patterns:** Non-extractable CryptoKey objects, no console logs in production, strict CSP
- **Offline-first:** All modules must fail gracefully without network
- **No breaking changes:** Preserve all existing exports; only add/document, don't remove
- **Test coverage:** All new documentation must include test contract examples
- **Import direction:** `presentation` → `data/repositories` → `domain`, `core` is dependency-free (except crypto/utils)

---

## Task 1: Create `src/ARCHITECTURE.md` — Layer Overview

**Files:**
- Create: `src/ARCHITECTURE.md`

**Steps:**

- [ ] Create architecture documentation file with complete content (see plan details)
- [ ] Verify file creation
- [ ] Commit with message: "docs: add layer architecture guide for AI agents"

---

## Task 2: Create `src/core/auth/index.ts` — Auth Module Public API

**Files:**
- Create: `src/core/auth/index.ts`

**Steps:**

- [ ] Create index.ts with all public exports for auth module
- [ ] Verify exports compile without type errors
- [ ] Commit with message: "feat: add public API export for auth module"

---

## Task 3: Create `src/core/auth/README.md` — Auth Module Contract

**Files:**
- Create: `src/core/auth/README.md`

**Steps:**

- [ ] Create module documentation with public API examples
- [ ] Verify file creation
- [ ] Commit with message: "docs: add auth module contract documentation for AI agents"

---

## Task 4: Create index.ts for remaining Core modules

**Files:**
- Create: `src/core/breach/index.ts`
- Create: `src/core/crypto/index.ts`
- Create: `src/core/ocr/index.ts`
- Create: `src/core/autofill/index.ts`
- Create: `src/core/utils/index.ts`

**Steps:**

- [ ] Create all five index.ts files with public API exports
- [ ] Verify all type-check passes
- [ ] Commit with message: "feat: add public API exports for all core modules"

---

## Task 5: Create index.ts for Data & Domain Layers

**Files:**
- Create: `src/data/repositories/index.ts`
- Create: `src/data/storage/index.ts`
- Create: `src/domain/entities/index.ts`
- Create: `src/domain/repositories/index.ts`

**Steps:**

- [ ] Create all four index.ts files for data and domain layers
- [ ] Verify type-check passes
- [ ] Commit with message: "feat: add public API exports for data and domain layers"

---

## Task 6: Create index.ts for Presentation Layer & Remaining Core READMEs

**Files:**
- Create: `src/presentation/pages/index.ts`
- Create: `src/presentation/store/index.ts`
- Create: `src/presentation/components/index.ts`
- Create: `src/core/breach/README.md`
- Create: `src/core/crypto/README.md`
- Create: `src/core/autofill/README.md`
- Create: `src/core/ocr/README.md`

**Steps:**

- [ ] Create presentation layer index.ts files
- [ ] Create remaining core module README files
- [ ] Verify type-check passes
- [ ] Commit with message: "feat: add presentation layer exports and core module documentation"

---

## Task 7: Consolidate Test Utilities & Create Test Fixtures

**Files:**
- Create: `src/__tests__/fixtures/mockCredentials.ts`
- Create: `src/__tests__/fixtures/mockUsers.ts`
- Create: `src/__tests__/fixtures/index.ts`

**Steps:**

- [ ] Create mock credentials fixture
- [ ] Create mock users fixture
- [ ] Create fixtures index.ts
- [ ] Verify test setup
- [ ] Commit with message: "test: add centralized test fixtures for credentials and users"

---

## Task 8: Create Presentation Layer Module Documentation

**Files:**
- Create: `src/presentation/pages/README.md`
- Create: `src/presentation/store/README.md`
- Create: `src/presentation/components/README.md`

**Steps:**

- [ ] Create pages module README
- [ ] Create store module README
- [ ] Create components module README
- [ ] Verify type-check passes
- [ ] Commit with message: "docs: add presentation layer module documentation"

---

## Task 9: Create AI Tool Configuration Files

**Files:**
- Create: `.aider.conf.json`
- Create: `.codeium.json`
- Create: `.cursor.conf.json`
- Create: `.claude/config.json`

**Steps:**

- [ ] Create Aider configuration
- [ ] Create Codeium configuration
- [ ] Create Cursor configuration
- [ ] Create Claude Code configuration
- [ ] Verify all config files exist
- [ ] Commit with message: "config: add AI tool configurations for Aider, Codeium, Cursor, and Claude Code"

---

## Task 10: Create Comprehensive Developer Guide

**Files:**
- Create: `src/MODULE_CONTRACTS.md`
- Create: `DEVELOPMENT.md`
- Create: `TESTING_PATTERNS.md`

**Steps:**

- [ ] Create MODULE_CONTRACTS.md documenting all public APIs
- [ ] Create DEVELOPMENT.md with TDD workflow
- [ ] Create TESTING_PATTERNS.md with concrete examples
- [ ] Verify documentation files exist
- [ ] Commit with message: "docs: add comprehensive developer guide and testing patterns"

---

## Summary

This plan reorganizes the TrustVault PWA codebase for seamless AI-assisted development by adding:
1. Module entry points (index.ts)
2. Module documentation (README.md)
3. Architecture guide (ARCHITECTURE.md)
4. AI tool configurations (.aider.conf.json, etc.)
5. Developer guides (DEVELOPMENT.md, TESTING_PATTERNS.md, MODULE_CONTRACTS.md)
6. Test fixtures (src/__tests__/fixtures/)

All changes preserve existing architecture, security patterns, and code structure.
