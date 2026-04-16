# TrustVault PWA - AI Agent Instructions

**Security-First Credential Manager** | React 19 + TypeScript 5.7 + Vite 6 + Clean Architecture

---

## Current Objectives (Nov 2025)
1. **Vault Trust Hardening** – Patch vault key decrypt/read bugs, wire `useAutoLock`, scrub decrypted state on lock, and document verification in `TEST_STATUS.md`.
2. **CredOps Experience** – Deliver credential CRUD UX, password generator, secure clipboard manager, search/filter, responsive dashboard, and TOTP display.
3. **Passwordless & Recovery** – Implement WebAuthn biometric unlock, change-master-password flows, and encrypted import/export with recovery copy.
4. **Threat Intelligence & Reporting** – Integrate breach detection UX, expand Vitest/integration coverage (>85%), and keep `SECURITY_AUDIT_REPORT.md` current.

When implementing new functionality:
- Reference `ROADMAP.md` for prompts + validation, and update it if acceptance criteria evolve.
- Touch companion docs (README/AGENTS/CLAUDE/copilot instructions) whenever developer workflows, tooling expectations, or ownership changes.
- Record manual verification evidence in `TEST_STATUS.md` (UX) and `SECURITY_AUDIT_REPORT.md` (security) before merging.

---

## Architecture Overview

This is an **offline-first PWA** using Clean Architecture with three distinct layers:

```
src/
├── presentation/   # React UI, Zustand stores, MUI components
├── domain/         # Business entities & repository interfaces
├── data/           # Repository implementations, IndexedDB (Dexie)
└── core/           # Crypto utilities, auth services
```

**Critical Rule**: Dependencies flow inward only. `presentation` → `domain` ← `data` ← `core`. Domain never imports from data/presentation.

### Path Aliases
Use `@/` imports everywhere (configured in tsconfig.json + vite.config.ts):
```typescript
import { User } from '@/domain/entities/User';
import { db } from '@/data/storage/database';
import { useAuthStore } from '@/presentation/store/authStore';
import { encrypt } from '@/core/crypto/encryption';
```

---

## Security & Cryptography

### 🔐 Password Hashing (Login Flow)
- **Algorithm**: Scrypt (via `@noble/hashes/scrypt`)
- **Parameters**: N=32768, r=8, p=1, dkLen=32
- **Hash Format**: `scrypt$N$r$p$base64salt$base64hash`
- **Location**: `src/core/crypto/password.ts` - `hashPassword()`, `verifyPassword()`

```typescript
// ✅ CORRECT - Use scrypt for master password
import { hashPassword, verifyPassword } from '@/core/crypto/password';
const hashedPassword = await hashPassword(masterPassword);
const isValid = await verifyPassword(inputPassword, storedHash);
```

### 🔑 Key Derivation (Vault Encryption)
- **Algorithm**: PBKDF2-SHA256
- **Iterations**: 600,000+ (OWASP 2025)
- **Salt**: 256-bit random per user
- **Output**: 256-bit AES-GCM key
- **Location**: `src/core/crypto/encryption.ts` - `deriveKeyFromPassword()`

### 🔒 Data Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **IV**: 96-bit random per operation
- **Location**: `src/core/crypto/encryption.ts` - `encrypt()`, `decrypt()`

**Pattern for encrypting credentials**:
```typescript
const vaultKey = useAuthStore(state => state.vaultKey); // CryptoKey
const encrypted = await encrypt(plaintext, vaultKey);
// Returns { ciphertext: string, iv: string }
```

---

## Critical Module Loading Pattern

### ⚠️ WASM/UMD Modules (argon2-browser)

**Problem**: Direct imports break Vite ESM builds  
**Solution**: Lazy dynamic imports with singleton pattern

```typescript
// ❌ WRONG - Breaks build
import argon2 from 'argon2-browser';

// ✅ CORRECT - Lazy load pattern (see password.ts for reference)
let modulePromise: Promise<any> | null = null;
async function loadModule() {
  if (!modulePromise) {
    modulePromise = import('argon2-browser').then(m => m.default || m);
  }
  return modulePromise;
}
```

**Note**: We switched from argon2-browser to scrypt (@noble/hashes) for simpler builds. If re-adding argon2:
1. Exclude from `optimizeDeps` in vite.config.ts
2. Use dynamic imports only
3. Load plugins in order: `wasm()`, `topLevelAwait()`, then `react()`

---

## State Management (Zustand)

### Auth Store Pattern
```typescript
// src/presentation/store/authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      vaultKey: null, // CryptoKey - never persisted
      isAuthenticated: false,
      isLocked: false,
      
      lockVault: () => set({ isLocked: true, vaultKey: null }),
      logout: () => set({ user: null, session: null, isAuthenticated: false }),
    }),
    {
      name: 'trustvault-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated })
      // Sensitive data (vaultKey, session) NOT persisted
    }
  )
);
```

**Key Points**:
- `vaultKey` stays in memory only (cleared on lock/logout)
- Auto-lock timer clears vaultKey but keeps user logged in
- Use `partialize` to exclude sensitive state from localStorage

---

## React 19 & StrictMode Patterns

### Effect Cleanup (Double Render in Dev)
React 19 StrictMode runs effects twice. Always use cleanup:

```typescript
useEffect(() => {
  let mounted = true;
  let hasCompleted = false;

  const completeInitialization = (source: string) => {
    if (mounted && !hasCompleted) {
      hasCompleted = true;
      console.log(`Init completed via ${source}`);
      setInitialized(true);
    }
  };

  const timeout = setTimeout(() => completeInitialization('timeout'), 2000);

  initializeDatabase()
    .then(() => { clearTimeout(timeout); completeInitialization('success'); })
    .catch(() => { clearTimeout(timeout); completeInitialization('error'); });

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, []); // Empty deps - run once per mount
```

**Pattern**: `mounted` flag + `hasCompleted` flag + timeout fallback for async operations

---

## Database (IndexedDB via Dexie)

### Schema
```typescript
// src/data/storage/database.ts
export class TrustVaultDB extends Dexie {
  credentials!: Table<StoredCredential, string>;
  users!: Table<StoredUser, string>;
  sessions!: Table<StoredSession, string>;
  settings!: Table<{ id: string; data: SecuritySettings }, string>;
}
```

### Offline-First Pattern
```typescript
// Always fail gracefully - app must work without DB
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('DB initialized');
  } catch (error) {
    console.error('DB failed:', error);
    // Don't throw - allow app to continue
  }
}
```

### Encrypted Fields
Store encrypted data as strings:
```typescript
interface StoredCredential {
  encryptedPassword: string; // Base64 encoded
  encryptedTotpSecret?: string;
  // Other fields in plaintext for indexing
}
```

---

## TypeScript Strict Mode

### Critical Flags Enforced
```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,  // arr[i] returns T | undefined
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true
}
```

### Common Fixes
```typescript
// ❌ Unchecked array access
const item = credentials[0].title;

// ✅ Null-safe
const item = credentials[0]?.title ?? 'Unknown';

// ❌ Missing return path
function getScore(x: number) {
  if (x > 0) return x;
  // Error: not all code paths return
}

// ✅ Explicit return
function getScore(x: number): number {
  return x > 0 ? x : 0;
}
```

---

## PWA & Service Worker

### Configuration (vite.config.ts)
```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
    skipWaiting: true,
    clientsClaim: true,
  },
  devOptions: { enabled: true } // SW enabled in dev mode
})
```

### Security Headers
Set via Vite dev server (lines 116-134), NOT meta tags:
```typescript
server: {
  headers: {
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'...",
  }
}
```

### PWA Icons Requirement
Must exist in `public/` as valid PNGs:
- `pwa-192x192.png`, `pwa-512x512.png`
- `pwa-maskable-192x192.png`, `pwa-maskable-512x512.png`
- `apple-touch-icon.png`, `favicon.ico`

---

## Development Workflow

### Commands
```bash
npm run dev          # HTTP dev server @ :3000
npm run dev:https    # HTTPS (required for WebAuthn)
npm run build        # Type-check → Production build
npm run type-check   # TypeScript validation only
npm run lint         # ESLint (max 0 warnings)
npm test             # Vitest unit tests
npm run lighthouse   # PWA audit (after preview)
```

### Pre-Commit Checklist
- [ ] `npm run type-check` passes
- [ ] `npm run lint` has 0 warnings
- [ ] No `console.log` in production code
- [ ] Security-sensitive changes reviewed
- [ ] Path aliases used (`@/` not `../../`)

### Build Optimization
Code splitting (vite.config.ts:154-159):
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'mui-vendor': ['@mui/material', '@mui/icons-material'],
  'security-vendor': ['@simplewebauthn/browser', '@noble/hashes'],
  'storage-vendor': ['dexie']
}
```

---

## Common Patterns

### Auto-Lock Implementation
```typescript
// src/presentation/hooks/useAutoLock.ts
export function useAutoLock(config: AutoLockConfig) {
  const lockVault = useAuthStore(state => state.lockVault);
  
  useEffect(() => {
    if (!config.enabled) return;
    
    const handleActivity = () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lockVault();
      }, config.timeoutMinutes * 60 * 1000);
    };
    
    document.addEventListener('mousemove', handleActivity);
    return () => document.removeEventListener('mousemove', handleActivity);
  }, [config, lockVault]);
}
```

### Clipboard with Auto-Clear
```typescript
// src/presentation/utils/clipboard.ts
export async function copyToClipboard(text: string, clearAfterMs: number = 30000) {
  await navigator.clipboard.writeText(text);
  
  setTimeout(async () => {
    const current = await navigator.clipboard.readText();
    if (current === text) {
      await navigator.clipboard.writeText('');
    }
  }, clearAfterMs);
}
```

---

## Testing Patterns

### Crypto Function Tests
```typescript
describe('Encryption', () => {
  it('should encrypt and decrypt correctly', async () => {
    const key = await generateEncryptionKey();
    const plaintext = 'sensitive data';
    
    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);
    
    expect(decrypted).toBe(plaintext);
    expect(encrypted.ciphertext).not.toBe(plaintext);
  });
});
```

---

## Security Guidelines

### Never Do This
- ❌ Log sensitive data (passwords, keys, tokens)
- ❌ Store `CryptoKey` in localStorage/sessionStorage
- ❌ Use `any` type for crypto operations
- ❌ Import UMD modules at top level
- ❌ Set security headers via meta tags

### Always Do This
- ✅ Use Web Crypto API for random generation
- ✅ Clear sensitive state on logout/lock
- ✅ Validate inputs before crypto operations
- ✅ Use constant-time comparisons for hashes
- ✅ Lazy load heavy modules (crypto, WASM)

---

## Troubleshooting

### "Loading spinner stuck"
**Cause**: JS module error preventing React mount  
**Fix**: Check console for import errors, verify DB init has timeout (<2s)

### "Invalid hash format" on login
**Cause**: Old argon2 hash in DB (if switching from argon2 to scrypt)  
**Fix**: Clear DB via `await db.delete()` or use debug utils

### TypeScript errors on build
**Symptom**: `npm run build` fails but dev works  
**Fix**: Run `npm run type-check` to see all errors. Enable strict mode fixes.

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Database schema | `src/data/storage/database.ts` |
| Encryption core | `src/core/crypto/encryption.ts` |
| Password hashing | `src/core/crypto/password.ts` |
| Auth state | `src/presentation/store/authStore.ts` |
| Credential state | `src/presentation/store/credentialStore.ts` |
| App routing | `src/presentation/App.tsx` |
| Build config | `vite.config.ts` |
| TypeScript config | `tsconfig.json` |

---

## External Documentation

- **Security Details**: See `SECURITY.md` for cryptographic specs
- **Project Setup**: See `PROJECT_OVERVIEW.md` for full context
- **Contribution**: See `CONTRIBUTING.md` for code standards
- **Quick Start**: See `QUICKSTART.md` for 3-minute setup

---

**Last Updated**: October 23, 2025  
**Node**: >=20.0.0 | **npm**: >=10.0.0 | **TypeScript**: 5.7.2 | **React**: 19.0.0
