# TrustVault PWA - Claude Code Guide

**Tech Stack:** React 19 + Vite 6.0.1 + TypeScript 5.7 + PWA + IndexedDB (Dexie)
**Architecture:** Clean Architecture (Domain/Data/Presentation) + Offline-First

---

## Current Mission (Nov 2025)
- **Vault Trust Hardening** – Fix vault key decrypt flow, ensure credential reads return plaintext in memory only, and wire auto-lock/session visibility guards.
- **CredOps Experience** – Complete credential forms, dashboard/search, password generator, secure clipboard manager, TOTP components, and responsive layouts.
- **Passwordless & Recovery** – Add WebAuthn biometric unlock, master password rotation UX, and encrypted import/export flows with recovery instructions.
- **Threat Intelligence & Reporting** – Integrate breach detection, OWASP-aligned audits, and >85% Vitest + integration coverage.

Every code change must link back to one of these pillars **and** update `ROADMAP.md`, `README.md`, or `AGENTS.md` if scope, validation, or ownership shifts.

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

**WASM/UMD Modules (argon2-browser):**
```typescript
// ❌ WRONG - Breaks build
import { hash } from 'argon2-browser';

// ✅ CORRECT - Lazy load to avoid blocking
let argon2Promise: Promise<any> | null = null;
async function loadArgon2() {
  if (!argon2Promise) {
    argon2Promise = import('argon2-browser').then(m => m.default || m);
  }
  return argon2Promise;
}
```
- **Never** top-level import `argon2-browser` (UMD module, breaks Vite ESM)
- Exclude from `optimizeDeps` in vite.config.ts
- Use dynamic imports for heavy crypto libs

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

**Set via HTTP (vite.config.ts:116-134), NOT meta tags:**
```typescript
headers: {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; ..."
}
```
- ❌ Never use `<meta http-equiv="X-Frame-Options">` (invalid)
- ✅ Security headers only via server config

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
- Code splitting via `manualChunks` (vite.config:154-159)
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

## React 19 Specific Features

**Automatic JSX Transform:**
- No need to `import React` in components
- `jsxRuntime: 'automatic'` in vite config

**StrictMode Double Rendering:**
- Development only (helps catch side effects)
- Use cleanup functions in `useEffect`
- Don't rely on effect running once

**Concurrent Features:**
- `useTransition` for non-urgent updates
- `useDeferredValue` for expensive renders
- Keep UI responsive during heavy operations

---

## Security Notes

**OWASP Mobile Top 10 Compliance:**
- M1: Improper Platform Usage → PWA security headers
- M2: Insecure Data Storage → Dexie encryption
- M3: Insecure Communication → CSP, HTTPS only
- M4: Insecure Authentication → Argon2id + WebAuthn
- M5: Insufficient Cryptography → @noble/hashes

**Sensitive Operations:**
- Master password hashing: Argon2id (3 iterations, 64MB memory)
- Vault key derivation: PBKDF2 (100k iterations)
- Biometric: WebAuthn with platform authenticator

---

**Last Updated:** 2025-10-22
**Node:** >=20.0.0 | **NPM:** >=10.0.0
