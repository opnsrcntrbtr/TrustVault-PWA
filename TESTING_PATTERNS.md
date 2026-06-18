# Testing Patterns — TrustVault PWA

This document shows common test patterns used in the project. Follow these for consistency.

## Test Organization

**Colocated tests:** Tests live next to the code they test.

```
src/
├── core/auth/
│   ├── webauthn.ts
│   ├── webauthn.test.ts    # Tests for webauthn.ts
│   ├── totp.ts
│   └── totp.test.ts
├── data/repositories/
│   ├── CredentialRepositoryImpl.ts
│   └── CredentialRepositoryImpl.test.ts
├── presentation/components/
│   ├── CredentialCard.tsx
│   └── CredentialCard.test.tsx
└── __tests__/
    ├── integration/         # Multi-module tests
    ├── fixtures/            # Shared mock data
    └── setup.ts
```

---

## Unit Tests

### Core Crypto Functions

```typescript
// src/core/crypto/encryption.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, deriveKeyFromPassword } from './encryption';

describe('encryption', () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await deriveKeyFromPassword('testPassword', 'testSalt');
  });

  it('encrypts and decrypts plaintext', async () => {
    const plaintext = 'secret credential';
    const encrypted = await encrypt(plaintext, key);
    expect(encrypted.ciphertext).toBeTruthy();

    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('produces non-extractable key', async () => {
    expect(key.extractable).toBe(false);
  });

  it('decryption fails with wrong key', async () => {
    const encrypted = await encrypt('secret', key);
    const wrongKey = await deriveKeyFromPassword('wrong', 'testSalt');
    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });
});
```

---

### Repository Methods

```typescript
// src/data/repositories/CredentialRepositoryImpl.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialRepositoryImpl } from './CredentialRepositoryImpl';
import { initializeDatabase } from '@/data/storage/database';
import { createMockCredential } from '@/__tests__/fixtures';

describe('CredentialRepositoryImpl', () => {
  let repo: CredentialRepositoryImpl;

  beforeEach(async () => {
    await initializeDatabase();
    repo = new CredentialRepositoryImpl(db);
  });

  afterEach(async () => {
    // Cleanup after test
  });

  it('creates credential', async () => {
    const input = createMockCredential();
    const created = await repo.create({ userId: 'user-1', ...input });
    expect(created.id).toBeTruthy();
    expect(created.username).toBe(input.username);
  });

  it('retrieves created credential', async () => {
    const input = createMockCredential({ username: 'john' });
    const created = await repo.create({ userId: 'user-1', ...input });
    const retrieved = await repo.getById(created.id);
    expect(retrieved?.username).toBe('john');
  });

  it('deletes credential', async () => {
    const created = await repo.create({ userId: 'user-1', ...createMockCredential() });
    await repo.delete(created.id);
    const deleted = await repo.getById(created.id);
    expect(deleted).toBeNull();
  });
});
```

---

### React Components

```typescript
// src/presentation/components/CredentialCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CredentialCard } from './CredentialCard';
import { createMockCredential } from '@/__tests__/fixtures';

describe('CredentialCard', () => {
  it('renders credential username', () => {
    const cred = createMockCredential({ username: 'john@example.com' });
    render(<CredentialCard credential={cred} />);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('calls onEdit when edit button clicked', () => {
    const cred = createMockCredential();
    const onEdit = vi.fn();
    render(<CredentialCard credential={cred} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(cred);
  });

  it('shows breach alert when password breached', () => {
    const cred = createMockCredential();
    render(<CredentialCard credential={cred} isBreached={true} />);
    expect(screen.getByText(/breached/i)).toBeInTheDocument();
  });

  it('disables delete button when loading', () => {
    const cred = createMockCredential();
    render(<CredentialCard credential={cred} loading={true} />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
  });
});
```

---

### React Hooks

```typescript
// src/presentation/store/authStore.test.ts
import { describe, it, expect } from 'vitest';
import { useAuthStore } from './authStore';
import { createMockUser } from '@/__tests__/fixtures';

describe('useAuthStore', () => {
  it('setUser updates auth state', () => {
    const store = useAuthStore.getState();
    const user = createMockUser();
    store.setUser(user);
    expect(store.user).toEqual(user);
    expect(store.isAuthenticated).toBe(true);
  });

  it('logout clears session vault key', () => {
    const store = useAuthStore.getState();
    store.logout();
    expect(store.sessionVaultKey).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });
});
```

---

## Integration Tests

Integration tests verify that multiple modules work together.

```typescript
// src/__tests__/integration/auth-flow.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { UserRepositoryImpl } from '@/data/repositories';
import { initializeDatabase } from '@/data/storage/database';
import { hashPassword, deriveKeyFromPassword } from '@/core/crypto';

describe('Authentication Flow', () => {
  let userRepo: UserRepositoryImpl;

  beforeEach(async () => {
    await initializeDatabase();
    userRepo = new UserRepositoryImpl(db);
  });

  it('sign up → sign in → unlock flow', async () => {
    // Sign up
    const password = 'SecurePassword123!';
    const { hash, salt } = await hashPassword(password);
    const registered = await userRepo.registerWithPassword('john@example.com', hash, salt);
    expect(registered.id).toBeTruthy();

    // Sign in
    const retrieved = await userRepo.getUserByEmail('john@example.com');
    expect(retrieved).toBeTruthy();

    // Unlock (derive session key)
    const sessionKey = await deriveKeyFromPassword(password, retrieved!.passwordSalt);
    expect(sessionKey.extractable).toBe(false);
  });
});
```

---

## Using Test Fixtures

Always use centralized fixtures from `src/__tests__/fixtures/`:

```typescript
import { createMockCredential, createMockUser } from '@/__tests__/fixtures';

const cred = createMockCredential({ username: 'john' });
const user = createMockUser({ email: 'john@example.com' });
```

**To add new fixtures:**
1. Add to `mockCredentials.ts` or `mockUsers.ts`
2. Export from `index.ts`
3. Use in tests

---

## Running Tests

```bash
# All tests
npm run test

# Specific module
npm run test -- src/core/auth

# Specific file
npm run test -- src/core/auth/webauthn.test.ts

# Watch mode
npm run test -- --watch

# Coverage report
npm run test:coverage
```

---

## Coverage Targets

- **Core modules** (crypto, auth): ≥90%
- **Repositories**: ≥80%
- **Components**: ≥70%
- **Overall**: ≥80%

Check coverage:
```bash
npm run test:coverage
```

---

## Test Checklist

- [ ] Use `@/` path aliases (not relative paths)
- [ ] Use fixtures from `@/__tests__/fixtures`
- [ ] Use `describe()` and `it()` (Vitest)
- [ ] Async operations use `async/await`
- [ ] Database tests cleanup in `afterEach()`
- [ ] Mock functions created with `vi.fn()`
- [ ] Component tests use `@testing-library/react`
- [ ] No `console.log()` or `debugger`
- [ ] Test name describes behavior, not implementation
- [ ] Test is independent (doesn't rely on other tests)
- [ ] Non-extractable keys verified in crypto tests
- [ ] Sensitive data never logged in tests

---

## Common Patterns

### Async Operations in Tests

```typescript
it('waits for async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Database Cleanup

```typescript
afterEach(async () => {
  // Reset DB state after each test
  await db.delete();
});
```

### Mocking Functions

```typescript
const mockFn = vi.fn();
const mockFn = vi.fn().mockReturnValue('value');
const mockFn = vi.fn().mockResolvedValue('async value');

expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(1);
```

### React Component Mocking

```typescript
vi.mock('@/presentation/store', () => ({
  useAuthStore: vi.fn().mockReturnValue({
    user: createMockUser(),
    isAuthenticated: true,
  }),
}));
```

---

## Before You Push

- ✅ All tests pass: `npm run test`
- ✅ Coverage target met
- ✅ No console.log() calls
- ✅ Tests are deterministic (don't flake)
- ✅ No hardcoded timeouts (use `vi.fake*()` instead)
