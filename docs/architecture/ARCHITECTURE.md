# TrustVault PWA Architecture

## Layer Structure

```
Presentation Layer (React components, pages, stores)
        ↓ imports
Data Layer (repositories, database, storage)
        ↓ imports
Domain Layer (entities, interfaces, contracts)
        ↓ imports
Core Layer (crypto, auth, utils — dependency-free)
```

### Core Layer (`src/core/`)

**Responsibility:** Provide cryptographic operations, authentication logic, and utilities that have **no external dependencies** (except crypto APIs).

**Modules:**
- `auth/` — WebAuthn, TOTP, biometric vault key derivation, username migration
- `breach/` — HIBP integration, breach detection, k-anonymity checks
- `crypto/` — Encryption/decryption, password hashing, key derivation
- `ocr/` — Tesseract OCR integration, camera capture, credential parsing
- `autofill/` — Autofill matching, extension bridge, domain validation
- `utils/` — Base64, helpers

**Import rule:** Core modules MUST NOT import from `data/`, `domain/`, or `presentation/`.

**Public API:** Each module exports via `index.ts`. See `MODULE_CONTRACTS.md` for details.

---

### Domain Layer (`src/domain/`)

**Responsibility:** Define entity types, repository interfaces, and business rules (no implementation).

**Modules:**
- `entities/` — `User.ts`, `Credential.ts`, `VaultProfile.ts`
- `repositories/` — `IUserRepository.ts`, `ICredentialRepository.ts`, `IProfileRepository.ts`

**Public API:** All exports via `index.ts`.

---

### Data Layer (`src/data/`)

**Responsibility:** Implement repositories and manage storage (IndexedDB via Dexie).

**Modules:**
- `repositories/` — `UserRepositoryImpl`, `CredentialRepositoryImpl`, `ProfileRepositoryImpl`, breach results, import validation
- `storage/` — Dexie database schema, migrations, debug utilities

**Public API:** All exports via `index.ts`.

---

### Presentation Layer (`src/presentation/`)

**Responsibility:** React components, pages, stores (Zustand), theming, styling.

**Modules:**
- `pages/` — Page-level components (SignIn, Dashboard, Settings, etc.)
- `store/` — Zustand stores (auth, credential, app state)
- `components/` — Reusable UI components (dialogs, cards, buttons)
- `theme/` — Theme configuration, dark mode
- `App.tsx` — Root component
- `hooks/` — React hooks (useAutoLock, usePasswordGenerator, etc.)

**Public API:** All exports via `index.ts`.

---

## Dependency Direction

```
Presentation → Data → Domain → Core
              ↓       ↓        ↓
           (import) (import) (no imports)
```

**Valid imports:**
- ✅ `presentation/pages/Dashboard.tsx` imports `useAuthStore` from `presentation/store/`
- ✅ `presentation/store/authStore.ts` imports `UserRepositoryImpl` from `data/repositories/`
- ✅ `data/repositories/UserRepositoryImpl.ts` imports `User` from `domain/entities/`
- ✅ `data/repositories/UserRepositoryImpl.ts` imports `encrypt()` from `core/crypto/`

**Invalid imports (auto-checked by .aider.conf.json):**
- ❌ `core/auth/webauthn.ts` imports from `data/`
- ❌ `data/repositories/UserRepositoryImpl.ts` imports from `presentation/`
- ❌ `domain/entities/User.ts` imports from `data/`

---

## Test Organization

**Pattern:** Colocated tests using `.test.ts` / `.test.tsx` suffix.

```
src/core/auth/
├── webauthn.ts
├── webauthn.test.ts            # Tests live next to code
├── biometricVaultKey.ts
├── biometricVaultKey.test.ts
└── ...
```

**Root test directory:** `src/__tests__/` for integration/e2e tests.

```
src/__tests__/
├── integration/
│   ├── auth-flow.test.tsx      # Multi-module integration
│   ├── credential-crud.test.tsx
│   └── ...
├── fixtures/                    # Shared test data
│   ├── mockCredentials.ts
│   └── mockUsers.ts
└── setup.ts                     # Global test setup
```

---

## Module Entry Points

Each module exports its public API via `src/<module>/index.ts`. This allows:
- **IDE autocomplete** to work correctly
- **AI agents** to understand what's public vs internal
- **Tree-shaking** to remove unused exports

Example: `src/core/auth/index.ts`
```typescript
// Public API
export { registerBiometric, authenticateBiometric } from './webauthn';
export { wrapVaultKeyWithPRF, unwrapVaultKeyWithPRF } from './biometricVaultKey';
export { generateTOTP, verifyTOTP } from './totp';
export type { WebAuthnCredential, AuthSession } from './types';

// Internal (not exported) — agents know not to use these directly
// - stripLegacyBiometric()
// - deriveWrapKeyFromPRF()
```

---

## Migration Path for AI Agents

When an agent is asked to work on a feature:

1. **Find the entry point:** Look up the module in `MODULE_CONTRACTS.md`
2. **Read the README:** Module-level documentation explains what the module does
3. **Check imports:** Follow the dependency direction; use `.aider.conf.json` to catch violations
4. **Write tests:** Follow test patterns in `TESTING_PATTERNS.md`
5. **Commit frequently:** Each logical change is a separate commit (TDD cycle)

---

## Key Patterns

### Offline-First Error Handling

All repository methods MUST handle IndexedDB failures gracefully:

```typescript
export async function getUser(id: string): Promise<User | null> {
  try {
    const stored = await db.users.get(id);
    return stored ? toDomain(stored) : null;
  } catch (error) {
    console.error('DB read failed:', error);
    return null; // Graceful fallback
  }
}
```

### StrictMode-Safe useEffect

All effects MUST handle double-invoke in React 19:

```typescript
useEffect(() => {
  let mounted = true;
  const timeout = setTimeout(() => { /* cleanup */ }, 2000);

  asyncWork().finally(() => {
    if (mounted) setData(result);
    clearTimeout(timeout);
  });

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, []);
```

### Security: Non-Extractable Keys

CryptoKey objects used for vault operations MUST have `extractable: false`:

```typescript
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
  passwordKey,
  { name: 'AES-GCM', length: 256 },
  false, // ← extractable MUST be false
  ['encrypt', 'decrypt']
);
```
