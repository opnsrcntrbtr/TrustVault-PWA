# TrustVault PWA - Claude Code Guide

**Tech Stack:** React 19 + Vite 6.4 + TypeScript 5.7 + PWA + IndexedDB (Dexie)
**Architecture:** Clean Architecture (Domain/Data/Presentation) + Offline-First

---

## Key Docs

[README](./README.md) → [PROJECT_CONTEXT](./PROJECT_CONTEXT.md) (hub, links all deep-dives) → [SECURITY](./SECURITY.md) → [ROADMAP](./ROADMAP.md)

---

## Current Status (June 2026)

Phase 1 complete (2026-05-30). Beta — 90% feature-complete. Active focus: test coverage >85%, production hardening, breach detection integration.

Every code change must update `ROADMAP.md`, `README.md`, or `AGENTS.md` if scope, validation, or ownership shifts.

### Definition of Done
1. Feature flagged or guarded if experimental.
2. `npm run type-check`, `npm run lint`, and targeted `npm run test` suites run locally.
3. Manual verification recorded in `TEST_STATUS.md` (and `SECURITY_AUDIT_REPORT.md` for security changes).
4. Doc touchpoints refreshed (README/ROADMAP/CLAUDE/copilot instructions as needed).
5. No sensitive data logged; CryptoKey objects stay memory-bound.

---

## Quick Commands

```bash
npm run dev          # Dev server @ :3000 (auto port if taken)
npm run build        # Type-check → Production build
npm run preview      # Preview production build
npm run type-check   # TypeScript validation only
npm run lint         # ESLint (max 0 warnings)
npm run test         # Vitest unit tests
npm run lighthouse   # PWA audit (target: >90 all metrics)
```

---

## Critical Rules

### 1. Module Loading Patterns

- **argon2-browser is NOT used** — removed due to CSP/WASM issues. Crypto uses `@noble/hashes/scrypt` instead (see `DATABASE_MIGRATION.md`).
- For any heavy WASM/UMD module: use lazy dynamic import + exclude from `optimizeDeps` in vite.config.ts. Never top-level import.

### 2. React 19 Patterns

**StrictMode Safe UseEffect:**
```typescript
useEffect(() => {
  let mounted = true;
  let hasCompleted = false;

  const completeInitialization = () => {
    if (mounted && !hasCompleted) {
      hasCompleted = true;
      setInitialized(true);
    }
  };

  // Async work with timeout fallback
  const timeout = setTimeout(completeInitialization, 2000);

  initializeDatabase()
    .then(() => { clearTimeout(timeout); completeInitialization(); })
    .catch(() => { clearTimeout(timeout); completeInitialization(); });

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, []); // Empty deps - run once
```
- React 19 StrictMode runs effects twice in dev
- Always use `mounted` flag to prevent state updates after unmount
- Timeout fallbacks for DB/network operations (max 2s)

### 3. PWA/Offline-First

**Database Initialization:**
```typescript
// Always fail gracefully - app must work offline
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('DB initialized');
  } catch (error) {
    console.error('DB failed:', error);
    // Don't throw - allow app to continue without persistence
  }
}
```

**Service Worker (vite-plugin-pwa):**
- Auto-updates via `registerType: 'autoUpdate'`
- Caches: `js,css,html,ico,png,svg,woff2,wasm`
- Runtime caching: `CacheFirst` for fonts
- Dev SW enabled (`devOptions.enabled: true`)

### 4. TypeScript Strict Mode

```typescript
// tsconfig.json strict flags ENFORCED
strict: true
noUncheckedIndexedAccess: true  // array[i] returns T | undefined
exactOptionalPropertyTypes: true // optional props can't be undefined
noImplicitReturns: true
```

**Common Fixes:**
```typescript
// ❌ Unchecked array access
const item = array[0].name; // Error if array empty

// ✅ Null-safe access
const item = array[0]?.name ?? 'default';

// ❌ Missing return
function process(x: number) {
  if (x > 0) return x;
  // Error: not all code paths return
}

// ✅ Explicit return
function process(x: number): number {
  return x > 0 ? x : 0;
}
```

### 5. Path Aliases (tsconfig + vite)

```typescript
import { User } from '@/domain/entities/User';
import { db } from '@/data/storage/database';
import { useAuthStore } from '@/presentation/store/authStore';
```

**Structure:**
```
src/
├── core/          # Crypto, auth utilities
├── data/          # Repositories, IndexedDB
├── domain/        # Entities, interfaces
└── presentation/  # React components, stores
    ├── pages/
    ├── store/     # Zustand
    └── theme/
```

### 6. Security Headers

**Set via HTTP, NOT meta tags.** Headers are defined in `src/config/securityHeaders.ts` and imported by vite.config.ts (applied at `server.headers` and `preview.headers`).
- ❌ Never use `<meta http-equiv="X-Frame-Options">` (invalid)
- ❌ Never duplicate headers inline in vite.config.ts — edit `securityHeaders.ts` only

### 7. PWA Icons Requirements

**Required files in `public/`:**
```
pwa-192x192.png          # 192x192 PNG
pwa-512x512.png          # 512x512 PNG
pwa-maskable-192x192.png # 192x192 with safe zone
pwa-maskable-512x512.png # 512x512 with safe zone
apple-touch-icon.png     # 180x180 for iOS
favicon.ico              # 32x32
```
- Must be **valid PNG** (not 1x1 placeholders in production)
- Maskable icons: content within 40% safe zone

### 8. Performance Targets (Lighthouse)

```bash
npm run lighthouse  # After preview server running
```

**Minimum scores (all >90):**
- Performance: >90 (FCP <1.8s, LCP <2.5s, CLS <0.1)
- Accessibility: >90
- Best Practices: >90
- SEO: >90
- PWA: 100 (installable, works offline)

**Optimization:**
- Code splitting via `manualChunks` (vite.config.ts ~line 159)
- `drop_console: true` in production
- Lazy load heavy modules (crypto, charts)
- IndexedDB for offline data

### 9. State Management

**Zustand (not Redux):**
```typescript
// stores use Zustand for simplicity
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
}));
```

**IndexedDB (Dexie):**
```typescript
// Encrypted local storage
export class TrustVaultDB extends Dexie {
  credentials!: Table<StoredCredential, string>;
  users!: Table<StoredUser, string>;
}
```

---

## Troubleshooting

### Loading Spinner Stuck
**Symptom:** Static HTML spinner never replaced
**Cause:** JS module error preventing React mount
**Fix:**
1. Check console for import errors (especially UMD modules)
2. Verify DB init has timeout fallback (<2s)
3. Use dynamic imports for WASM/crypto libs

### PWA Icon Errors
**Symptom:** `Download error or resource isn't a valid image`
**Fix:** Ensure icons are valid PNG at required sizes (not 1x1)
```bash
file public/pwa-192x192.png  # Should show: PNG image data, 192 x 192
```

### TypeScript Errors on Build
**Symptom:** `npm run build` fails, but dev works
**Fix:** Run `npm run type-check` to see all errors
- Enable `strict: true` compliance
- Check array access: `arr[i]` → `arr[i]?`
- Explicit return types for complex functions

### WASM Loading Fails
**Symptom:** `Could not resolve "a"` in argon2-browser
**Fix:**
- Exclude from `optimizeDeps`
- Use lazy dynamic import (see Module Loading Patterns)
- Ensure `vite-plugin-wasm` loads before React plugin

### Service Worker Not Updating
**Symptom:** Old version cached after deploy
**Fix:**
- `skipWaiting: true` in workbox config (already set)
- Hard refresh: Cmd+Shift+R / Ctrl+Shift+R
- Check Application → Service Workers in DevTools

---

## Code Standards Checklist

- [ ] TypeScript strict mode compliant (no `any`, proper null checks)
- [ ] React 19 patterns (mounted flags, cleanup functions)
- [ ] Lazy load heavy modules (>100KB, crypto, WASM)
- [ ] Error boundaries for critical sections
- [ ] Offline-first (graceful DB failures, cached UI)
- [ ] Security headers via HTTP (not meta tags)
- [ ] PWA icons valid PNG at required sizes
- [ ] Console logs removed in production (`drop_console: true`)
- [ ] Lighthouse scores >90 (run before PR merge)
- [ ] Path aliases used (`@/` instead of `../../`)

---

## Security Notes

**OWASP Mobile Top 10 Compliance (M1–M5 addressed):**
- M1: Improper Platform Usage → PWA security headers
- M2: Insecure Data Storage → Dexie encryption
- M3: Insecure Communication → CSP, HTTPS only
- M4: Insecure Authentication → Scrypt + WebAuthn
- M5: Insufficient Cryptography → @noble/hashes

**Sensitive Operations:**
- Master password hashing: Scrypt via `@noble/hashes/scrypt` (N=32768, r=8, p=1, dkLen=32). Migrated from Argon2id to avoid CSP/WASM issues — see `DATABASE_MIGRATION.md`.
- Vault key derivation: PBKDF2-SHA256 (600,000 iterations, OWASP 2025)
- Biometric: WebAuthn platform authenticator with the **PRF extension (S1)**. The vault key is wrapped with an HKDF-SHA256 key derived from the authenticator's PRF output (never stored), so biometric unlock is demonstrably zero-knowledge — stored data alone cannot unlock the vault. Scheme `vaultKeyScheme: 'prf-v1'`; legacy device-key credentials are stripped by the DB v7 migration; non-PRF devices fall back to master password. See `SECURITY.md`.

---

**Last Updated:** 2026-06-10
**Node:** >=20.0.0 | **NPM:** >=10.0.0

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
