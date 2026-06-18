# TrustVault PWA — Development Guide

Welcome! This guide helps you contribute with confidence.

## Before You Start

1. **Read the docs:**
   - `src/ARCHITECTURE.md` — Layer structure & import rules
   - `src/MODULE_CONTRACTS.md` — What APIs exist
   - `CLAUDE.md` — Project-specific patterns

2. **Verify setup:**
   ```bash
   npm install
   npm run type-check      # No errors?
   npm run lint            # No errors?
   npm run test            # All passing?
   ```

3. **Understand layers:**
   - `src/core/` — Crypto, auth, utilities (no dependencies)
   - `src/domain/` — Entity types and interfaces
   - `src/data/` — Repositories, database
   - `src/presentation/` — React components, stores

---

## Workflow: Adding a Feature

### 1. Design the API

**Question:** Which layer(s) does this feature touch?

```
Example: Credential search
  └─ presentation/pages/DashboardPage
  └─ presentation/components/SearchBar
  └─ presentation/store/credentialStore
  └─ data/repositories/CredentialRepositoryImpl
  └─ core/utils/search
```

**For each layer, design the contract:**
- What functions/types does this layer expose?
- What does it import from layers below?

---

### 2. Write Tests First (TDD)

**File:** `src/core/utils/search/search.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { searchCredentials } from './search';
import { createMockCredential } from '@/__tests__/fixtures';

describe('searchCredentials', () => {
  it('matches username', () => {
    const creds = [
      createMockCredential({ username: 'john' }),
      createMockCredential({ username: 'jane' }),
    ];
    const results = searchCredentials(creds, 'john');
    expect(results).toHaveLength(1);
  });
});
```

**Run & verify it fails:**
```bash
npm run test -- src/core/utils/search/search.test.ts
# FAIL: searchCredentials is not defined
```

---

### 3. Implement Minimal Code

**File:** `src/core/utils/search/search.ts`

```typescript
export function searchCredentials(credentials: Credential[], query: string) {
  return credentials.filter(c => 
    c.username.toLowerCase().includes(query.toLowerCase())
  );
}
```

---

### 4. Run Tests & Type-Check

```bash
npm run test -- src/core/utils/search/search.test.ts
# PASS
npm run type-check
# No errors
npm run lint
# No errors
```

---

### 5. Commit Frequently

```bash
git add src/core/utils/search/search.ts src/core/utils/search/search.test.ts
git commit -m "feat: add credential search"
```

---

## Code Standards

- **TypeScript strict mode** — no `any`, proper null checks
- **React 19 patterns** — mounted flags, cleanup in effects
- **Non-extractable keys** — vault operations use `extractable: false`
- **Offline-first** — graceful fallback if network unavailable
- **Security:** No sensitive data in logs, validate imported data with Zod
- **Tests:** Unit tests colocated with code (`.test.ts` / `.test.tsx`)

---

## Debugging

**Type errors?**
```bash
npm run type-check
```

**Lint errors?**
```bash
npm run lint --fix
```

**Tests failing?**
```bash
npm run test -- src/path/to/test.ts --reporter=verbose
```

**Build issues?**
```bash
npm run build
```

---

## Security Reminders

- **Master password:** Never logs or exports
- **Session vault key:** Non-extractable CryptoKey, cleared on logout
- **Sensitive data:** Encrypted at rest, never stored plaintext
- **CSP headers:** Strict, configured in `src/config/securityHeaders.ts`
- **Imports:** Validate with Zod (S8)

---

## Documentation

After code changes, update:
- `README.md` — High-level overview
- `CLAUDE.md` — Developer patterns (if you changed patterns)
- Module `README.md` — If you changed public API
- `ARCHITECTURE.md` — If you changed layer structure

---

## Quick Reference

```bash
npm run dev              # Start dev server @ :3000
npm run build            # Production build
npm run type-check       # TypeScript validation
npm run lint --fix       # Lint & auto-fix
npm run test             # Run all tests
npm run test -- --watch  # Watch mode
npm run lighthouse       # PWA audit (after preview server running)
```

---

## Before You Push

1. ✅ `npm run type-check` passes
2. ✅ `npm run lint` passes (0 warnings)
3. ✅ `npm run test` passes locally
4. ✅ Tests added for new code
5. ✅ Documentation updated
6. ✅ No sensitive data logged
7. ✅ Commit messages follow convention
