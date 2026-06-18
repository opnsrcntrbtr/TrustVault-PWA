# Presentation: State Management (`src/presentation/store/`)

## Purpose

Zustand stores managing global application state (authentication, credentials, app settings).

## Public API

### AuthStore

```typescript
import { useAuthStore } from '@/presentation/store';

const { user, isAuthenticated, setUser, logout } = useAuthStore();
```

**State:**
- `user: User | null` — Current authenticated user
- `isAuthenticated: boolean`
- `sessionVaultKey: CryptoKey | null` — Non-extractable vault key for current session
- `lastAuthAt: Date | null`

**Actions:**
- `setUser(user: User)` — Set authenticated user
- `logout()` — Clear session and session key
- `setSessionVaultKey(key: CryptoKey)` — Store non-extractable vault key
- `updateSecuritySettings(settings: SecuritySettings)`

---

### CredentialStore

```typescript
import { useCredentialStore } from '@/presentation/store';

const {
  credentials,
  filteredCredentials,
  addCredential,
  updateCredential,
  deleteCredential,
} = useCredentialStore();
```

**State:**
- `credentials: Credential[]` — All credentials for current user
- `filteredCredentials: Credential[]` — After applying search/filter
- `filter: CredentialFilter`
- `sortOrder: SortOrder`

**Actions:**
- `addCredential(cred: CredentialInput)`
- `updateCredential(id: string, cred: CredentialInput)`
- `deleteCredential(id: string)`
- `setFilter(filter: CredentialFilter)`
- `setSortOrder(order: SortOrder)`

---

## Design Notes

### Why Zustand?

- **Minimal boilerplate:** No actions/reducers/dispatches
- **TypeScript-first:** Full type inference
- **Composition:** Easy to split stores later if needed
- **Performance:** Automatic subscriptions (only affected components re-render)

### Session Vault Key (Non-Extractable, S7)

The `sessionVaultKey` in `useAuthStore` is a **non-extractable CryptoKey**:

```typescript
// This is safe:
await encrypt(plaintext, sessionVaultKey);

// This will throw:
await crypto.subtle.exportKey('raw', sessionVaultKey);
// → InvalidAccessError: key is not extractable
```

This prevents a malicious service worker from stealing the vault key.

---

## Testing

**Location:** Colocated `.test.ts` files

Example: `src/presentation/store/authStore.test.ts`

```typescript
import { useAuthStore } from './authStore';

test('setUser updates auth state', () => {
  const store = useAuthStore.getState();
  const user = createMockUser();
  store.setUser(user);
  expect(store.user).toEqual(user);
  expect(store.isAuthenticated).toBe(true);
});

test('logout clears session vault key', () => {
  const store = useAuthStore.getState();
  store.logout();
  expect(store.sessionVaultKey).toBeNull();
});
```

---

## Checklist for New Stores

- [ ] Non-extractable CryptoKey objects for vault operations
- [ ] No sensitive data logged to console
- [ ] TypeScript strict mode
- [ ] Immer middleware for immutable updates (if mutating nested state)
- [ ] Test coverage ≥80%
