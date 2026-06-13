# TrustVault PWA - Claude Code Guide

**Tech Stack:** React 19 + Vite 6.4 + TypeScript 5.7 + PWA + IndexedDB (Dexie)
**Architecture:** Clean Architecture (Domain/Data/Presentation) + Offline-First

---

## Key Docs

[README](./README.md) → [PROJECT_CONTEXT](./PROJECT_CONTEXT.md) (hub, links all deep-dives) → [SECURITY](./SECURITY.md) → [ROADMAP](./ROADMAP.md)

---

## Current Status (June 2026)

Phase 1 done (2026-05-30). Beta — 90% feature-complete. Focus: test >85%, production hardening, breach detection.

Update `ROADMAP.md`, `README.md`, or `AGENTS.md` if scope/validation/ownership shifts.

### Definition of Done
1. Feature flagged or guarded if experimental.
2. `npm run type-check`, `npm run lint`, targeted `npm run test` pass locally.
3. Manual verification in `TEST_STATUS.md` (+ `SECURITY_AUDIT_REPORT.md` for security).
4. Docs refreshed (README/ROADMAP/CLAUDE/copilot as needed).
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

- **argon2-browser NOT used** — removed (CSP/WASM). Use `@noble/hashes/scrypt` instead (see `DATABASE_MIGRATION.md`).
- Heavy WASM/UMD: lazy dynamic import + exclude from `optimizeDeps` in vite.config.ts. Never top-level import.

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
- StrictMode runs effects 2x in dev
- Use `mounted` flag to prevent state updates after unmount
- Timeout fallbacks for DB/network (max 2s)

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
- Auto-updates: `registerType: 'autoUpdate'`
- Caches: `js,css,html,ico,png,svg,woff2,wasm`
- Runtime: `CacheFirst` for fonts
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

Set via HTTP, NOT meta tags. Defined in `src/config/securityHeaders.ts`, imported by vite.config.ts (`server.headers` + `preview.headers`).
- ❌ Never `<meta http-equiv="X-Frame-Options">` (invalid)
- ❌ Never duplicate headers inline — edit `securityHeaders.ts` only

### 7. PWA Icons Requirements

**Required in `public/`:**
```
pwa-192x192.png          # 192x192 PNG
pwa-512x512.png          # 512x512 PNG
pwa-maskable-192x192.png # 192x192 with safe zone
pwa-maskable-512x512.png # 512x512 with safe zone
apple-touch-icon.png     # 180x180 for iOS
favicon.ico              # 32x32
```
- Valid PNG (not 1x1 placeholders in prod)
- Maskable icons: content in 40% safe zone

### 8. Performance Targets (Lighthouse)

```bash
npm run lighthouse  # After preview server running
```

**Min scores (all >90):**
- Performance: >90 (FCP <1.8s, LCP <2.5s, CLS <0.1)
- Accessibility: >90
- Best Practices: >90
- SEO: >90
- PWA: 100 (installable, offline)

**Optimize:** `manualChunks` (vite.config.ts ~159), `drop_console: true` (prod), lazy-load heavy modules, IndexedDB for offline.

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
**Cause:** JS module error prevents React mount
**Fix:**
1. Check console for import errors (especially UMD)
2. Verify DB init has timeout fallback (<2s)
3. Use dynamic imports for WASM/crypto

### PWA Icon Errors
**Symptom:** `Download error or resource isn't a valid image`
**Fix:** Valid PNG at required sizes (not 1x1)
```bash
file public/pwa-192x192.png  # Should show: PNG image data, 192 x 192
```

### TypeScript Errors on Build
**Symptom:** `npm run build` fails, dev works
**Fix:** Run `npm run type-check`
- Enable `strict: true`
- Array access: `arr[i]` → `arr[i]?`
- Explicit return types for complex functions

### WASM Loading Fails
**Symptom:** `Could not resolve "a"` in argon2-browser
**Fix:**
- Exclude from `optimizeDeps`
- Lazy dynamic import (see Module Loading Patterns)
- Ensure `vite-plugin-wasm` loads before React plugin

### Service Worker Not Updating
**Symptom:** Old version cached post-deploy
**Fix:**
- `skipWaiting: true` in workbox (already set)
- Hard refresh: Cmd+Shift+R / Ctrl+Shift+R
- Check Application → Service Workers in DevTools

---

## Code Standards Checklist

- [ ] TypeScript strict mode (no `any`, proper null checks)
- [ ] React 19 patterns (mounted flags, cleanup)
- [ ] Lazy-load heavy modules (>100KB, crypto, WASM)
- [ ] Error boundaries for critical sections
- [ ] Offline-first (graceful DB failures, cached UI)
- [ ] Security headers via HTTP (not meta tags)
- [ ] PWA icons valid PNG at required sizes
- [ ] Console logs removed in production (`drop_console: true`)
- [ ] Lighthouse >90 (run before PR merge)
- [ ] Path aliases used (`@/` not `../../`)

---

## Security Notes

**OWASP Mobile Top 10 (M1–M5):**
- M1: Improper Platform Usage → PWA security headers
- M2: Insecure Data Storage → Dexie encryption
- M3: Insecure Communication → CSP, HTTPS only
- M4: Insecure Authentication → Scrypt + WebAuthn
- M5: Insufficient Cryptography → @noble/hashes

**Sensitive Operations:**
- Master password hashing: Scrypt via `@noble/hashes/scrypt` (N=131072, r=8, p=1, dkLen=32). Migrated from Argon2id (CSP/WASM) — see `DATABASE_MIGRATION.md`.
- Vault key derivation: PBKDF2-SHA256 (600,000 iterations, OWASP 2025)
- Key hygiene (S7, 2026-06-10): session vault keys non-extractable both unlock paths; transient material zeroized; biometric enrollment confirms master password (never exports session key).
- CSP (S2, 2026-06-10): strict hash-based — `script-src 'self' 'sha256-…' 'wasm-unsafe-eval'`, no `unsafe-inline`/`unsafe-eval`. Source: `src/config/securityHeaders.ts` (hash drift guard + vercel.json parity). OCR (Tesseract) self-hosted at `public/ocr/` (via `scripts/copy-ocr-assets.js` pre-hooks) — no CDN egress.
- Biometric: WebAuthn platform authenticator + PRF extension (S1). Vault key wrapped with HKDF-SHA256 from PRF output (never stored) → zero-knowledge unlock. Scheme: `vaultKeyScheme: 'prf-v1'`; legacy stripped by DB v7 migration; non-PRF fallback to master password. See `SECURITY.md`.
- Background breach re-checks (P4, 2026-06-10): 5-char SHA-1 prefixes in `breachPrefixes` table (DB v8) — disclosed to HIBP under k-anonymity, residual documented in `SECURITY.md`. `public/sw-periodic-sync.js` (workbox `importScripts`) prefetches ranges into `hibp-ranges` cache while locked; unlock triggers 7-day staleness re-validation cache-first via `src/core/breach/rangeCache.ts`. Offline deep-links use `navigateFallback` (P1); manifest: `id`/`shortcuts`/`launch_handler` (P3, screenshots pending).
- Chrome extension (X1–X3, 2026-06-11): **no secrets at rest** — plaintext `chrome.storage.local` removed (legacy purged on install/update); `GET_CREDENTIALS` empty until secure transport from PWA's encrypted vault, fill path stays inert. Permissions minimal: no `webNavigation`, host limited to TrustVault origins, content script HTTPS-only, dead `web_accessible_resources` removed. Autofill matcher (`src/core/autofill/credentialManagementService.ts`): dot-boundary host-suffix matching + scheme equality — never naive eTLD (`mybank.co.uk` ≠ `evil.co.uk`).

---

**Last Updated:** 2026-06-11 (Chrome extension hardening X1–X3; prev: security A–E, PWA offline P1/P3/P4)
**Node:** ≥20.0.0 | **NPM:** ≥10.0.0

## graphify

Knowledge graph at graphify-out/ with god nodes, community structure, cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before source files, grep/glob, or codebase questions. Graph is primary map.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of raw files
- Cross-module "how does X relate to Y": prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — traverses EXTRACTED + INFERRED edges
- After code changes, run `graphify update .` to keep current (AST-only, no API cost)