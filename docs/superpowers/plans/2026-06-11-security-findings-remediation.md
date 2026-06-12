# Security Findings Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six 2026-06-11 audit findings: per-user data partitioning, minimal persisted auth state, scrypt-bound vault-key wrapping, gated autofill, honest rate-limiter claims, and stale-artifact cleanup.

**Architecture:** All fixes stay inside the existing Clean Architecture layers. Partitioning is a Dexie v9 migration plus repository-level ownership guards (ownership of legacy rows is proven cryptographically — AES-GCM decryption success — and claimed lazily). Auth persistence shrinks to a `{id, username, displayName}` shell with a Zustand persist `version`/`migrate` that wipes old secret-bearing snapshots. Vault-key wrapping moves to scrypt (S4 params) with a `vaultKdf` marker and transparent upgrade-on-login, mirroring the existing `needsRehash` pattern.

**Tech Stack:** TypeScript 5.7 (strict), Dexie 4 (IndexedDB), Zustand persist, @noble/hashes scrypt, Vitest + fake-indexeddb.

**Validation context (verified 2026-06-11 against the codebase):**
- `StoredCredential` (database.ts:20) has no `userId`; v8 schema indexes `id, category, isFavorite, createdAt, updatedAt` only. `StoredBreachResult` and `StoredBreachPrefix` key off `credentialId` only. Finding 1 CONFIRMED.
- `authStore.ts:97-104` `partialize` persists the full `user` object; `User` (User.ts:5-24) carries `hashedMasterPassword`, `encryptedVaultKey`, `salt`, and `webAuthnCredentials` (incl. `wrappedVaultKey`/`prfSalt`). `SigninPage.tsx:71-76` sets that full object. Finding 2 CONFIRMED.
- `password.ts:16-21` scrypt N=131072 (2^17), but the vault key is wrapped under PBKDF2-600k keys at UserRepositoryImpl lines 38 (createUser), 121 (login), 379 (biometric confirm), 482/489 (changeMasterPassword). Finding 3 CONFIRMED.
- `rateLimiter.ts` stores lockouts in the local `loginAttempts` Dexie table. Finding 4 CONFIRMED (doc fix only).
- `AddCredentialPage.tsx:224-239` and `EditCredentialPage.tsx:281-295` call `storeCredentialInBrowser` gated only on category/url/API support — NOT on the autofill opt-in (`DEFAULT_AUTOFILL_SETTINGS.enabled === false` is ignored). Extension fill path already inert (X1). Finding 5 CONFIRMED.
- `src/assets/argon2.wasm` (25,725 bytes, Oct 2025) exists; no runtime references. `User.ts:16` comment falsely says "Argon2id hash"; CLAUDE.md says scrypt N=32768 but code is N=131072. Finding 6 CONFIRMED.

---

### Task 1: Per-user partitioning of credentials, breach results, and breach prefixes (DB v9)

**Files:**
- Modify: `src/data/storage/database.ts` (interfaces ~lines 20, 97, 117; schema constructor ~line 143)
- Modify: `src/data/repositories/CredentialRepositoryImpl.ts` (createWithId :59, create :105, findAll :116, findById, update, delete, save :405-437, and the search/category/favorites finders)
- Modify: `src/domain/repositories/CredentialRepository.ts` (interface — add `userId` params)
- Modify: `src/core/breach/breachPrefixStore.ts`, `src/data/repositories/breachResultsRepository.ts` (scope writes/reads by userId)
- Modify call sites that pass the new param (enumerate with the grep in Step 6)
- Test: `src/data/repositories/__tests__/userIsolation.test.ts` (new)

- [ ] **Step 1: Write the failing two-user isolation test**

```typescript
// src/data/repositories/__tests__/userIsolation.test.ts
/**
 * Two-user isolation invariant: one unlocked user must not be able to
 * enumerate, read, modify, or delete another user's credential rows,
 * even sharing the same browser-profile IndexedDB.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';

async function makeVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const loginInput = (title: string) => ({
  title,
  username: 'user@example.com',
  password: 'secret-password-123',
  category: 'login' as const,
  tags: [],
});

describe('two-user credential isolation', () => {
  let keyA: CryptoKey;
  let keyB: CryptoKey;
  const userA = 'user-a-id';
  const userB = 'user-b-id';

  beforeEach(async () => {
    await db.credentials.clear();
    keyA = await makeVaultKey();
    keyB = await makeVaultKey();
  });

  it('findAll returns only the calling user’s credentials', async () => {
    await credentialRepository.create(loginInput('A1'), keyA, userA);
    await credentialRepository.create(loginInput('A2'), keyA, userA);
    await credentialRepository.create(loginInput('B1'), keyB, userB);

    const aRows = await credentialRepository.findAll(keyA, userA);
    const bRows = await credentialRepository.findAll(keyB, userB);

    expect(aRows.map((c) => c.title).sort()).toEqual(['A1', 'A2']);
    expect(bRows.map((c) => c.title)).toEqual(['B1']);
  });

  it('findById returns null for another user’s credential', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    expect(await credentialRepository.findById(a.id, keyB, userB)).toBeNull();
  });

  it('update refuses to touch another user’s credential', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    await expect(
      credentialRepository.update(a.id, { title: 'hijacked' }, keyB, userB)
    ).rejects.toThrow();
    const fresh = await credentialRepository.findById(a.id, keyA, userA);
    expect(fresh?.title).toBe('A1');
  });

  it('delete refuses to remove another user’s credential', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    await expect(credentialRepository.delete(a.id, userB)).rejects.toThrow();
    expect(await credentialRepository.findById(a.id, keyA, userA)).not.toBeNull();
  });

  it('legacy unowned rows are lazily claimed only by the user whose key decrypts them', async () => {
    const a = await credentialRepository.create(loginInput('A1'), keyA, userA);
    // Simulate a pre-v9 row: strip ownership.
    await db.credentials.update(a.id, { userId: undefined });

    // B's key cannot decrypt the row → B must not see or claim it.
    expect(await credentialRepository.findAll(keyB, userB)).toEqual([]);
    expect((await db.credentials.get(a.id))?.userId).toBeUndefined();

    // A's key decrypts it → A sees it and the row is claimed.
    const aRows = await credentialRepository.findAll(keyA, userA);
    expect(aRows.map((c) => c.title)).toEqual(['A1']);
    expect((await db.credentials.get(a.id))?.userId).toBe(userA);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/repositories/__tests__/userIsolation.test.ts`
Expected: FAIL — TypeScript/arity errors (`create` takes 2 args, not 3) and/or cross-user rows returned.

- [ ] **Step 3: Add `userId` to the stored types and the v9 schema**

In `src/data/storage/database.ts`:

```typescript
export interface StoredCredential {
  id: string;
  /**
   * Owning user (v9+). Optional only for pre-v9 legacy rows, which are
   * lazily claimed when their owner's vault key successfully decrypts them
   * (AES-GCM auth failure proves non-ownership). All new writes set it.
   */
  userId?: string | undefined;
  // ... existing fields unchanged ...
}
```

Add the same `userId?: string | undefined` field (with the same comment) to `StoredBreachResult` and `StoredBreachPrefix`.

In the `TrustVaultDB` constructor, after the version(8) block, add:

```typescript
    // Version 9 - Per-user partitioning (audit 2026-06-11, Finding 1)
    // credentials/breachResults/breachPrefixes gain a userId owner column.
    // Backfill: if exactly one user exists, all rows belong to that user.
    // Multi-user DBs leave userId undefined; rows are claimed lazily on
    // first successful decryption by their owner (cryptographic proof).
    this.version(9)
      .stores({
        credentials:
          'id, userId, [userId+category], [userId+isFavorite], category, isFavorite, createdAt, updatedAt',
        users: userStoreSchemaV7,
        sessions: sessionStoreSchema,
        settings: 'id',
        breachResults:
          'id, userId, credentialId, checkType, breached, severity, checkedAt, expiresAt',
        loginAttempts: 'email, lockedUntil',
        breachPrefixes: 'credentialId, userId, sha1Prefix, updatedAt',
      })
      .upgrade(async (tx) => {
        const users = await tx.table<StoredUser>('users').toArray();
        if (users.length !== 1) return; // multi-user: lazy claim handles it
        const owner = users[0]?.id;
        if (!owner) return;
        await tx.table<StoredCredential>('credentials').toCollection().modify((c) => {
          if (c.userId === undefined) c.userId = owner;
        });
        await tx.table<StoredBreachResult>('breachResults').toCollection().modify((r) => {
          if (r.userId === undefined) r.userId = owner;
        });
        await tx.table<StoredBreachPrefix>('breachPrefixes').toCollection().modify((p) => {
          if (p.userId === undefined) p.userId = owner;
        });
      });
```

- [ ] **Step 4: Thread `userId` through `CredentialRepository`**

In `src/domain/repositories/CredentialRepository.ts`, add a trailing `userId: string` parameter to every method that reads or writes credential rows (`create`, `findById`, `findAll`, `update`, `delete`, `search`, `findByCategory`, `findFavorites`, `exportAll`, `importFromJson`, `save`, …). Example:

```typescript
findAll(decryptionKey: CryptoKey, userId: string): Promise<Credential[]>;
findById(id: string, decryptionKey: CryptoKey, userId: string): Promise<Credential | null>;
delete(id: string, userId: string): Promise<void>;
```

In `src/data/repositories/CredentialRepositoryImpl.ts`:

`createWithId` (line 59) — accept and persist the owner:

```typescript
  private async createWithId(
    id: string,
    input: CredentialInput,
    encryptionKey: CryptoKey,
    userId: string
  ): Promise<Credential> {
    // ...existing encryption logic unchanged...
    // In the StoredCredential object literal being put(), add:
    //   userId,
  }
```

`findAll` (line 116) — query by owner, attempt lazy claim of unowned rows:

```typescript
  async findAll(decryptionKey: CryptoKey, userId: string): Promise<Credential[]> {
    const owned = await db.credentials.where('userId').equals(userId).toArray();
    const unowned = await db.credentials
      .filter((c) => c.userId === undefined)
      .toArray();

    const results: Credential[] = [];
    for (const stored of owned) {
      results.push(await this.decryptCredential(stored, decryptionKey));
    }
    for (const stored of unowned) {
      try {
        const cred = await this.decryptCredential(stored, decryptionKey);
        // Decryption succeeded → cryptographic proof of ownership. Claim it.
        await db.credentials.update(stored.id, { userId });
        results.push(cred);
      } catch {
        // Not ours — AES-GCM auth failed. Leave the row untouched.
      }
    }
    return results;
  }
```

`findById` — return `null` when `stored.userId !== undefined && stored.userId !== userId`; apply the same try-decrypt-then-claim for `undefined` owners.

`update` / `delete` — load the row first and throw `new Error('Credential not found')` when the owner check fails (same message as missing rows — do not leak existence):

```typescript
  async delete(id: string, userId: string): Promise<void> {
    const stored = await db.credentials.get(id);
    if (!stored || (stored.userId !== undefined && stored.userId !== userId)) {
      throw new Error('Credential not found');
    }
    await db.credentials.delete(id);
    await deleteBreachPrefix(id);
  }
```

`search`/`findByCategory`/`findFavorites` — start from `db.credentials.where('[userId+category]')`/`.where('userId')` instead of full-table scans, then reuse the findAll lazy-claim behavior for unowned rows. `create`/`save` forward `userId` to `createWithId`.

- [ ] **Step 5: Scope breach stores by user**

In `src/core/breach/breachPrefixStore.ts`: `saveBreachPrefix` gains `userId: string` and writes it; `getAllBreachPrefixes` gains optional `userId` to filter (the service worker has no user context while locked and may still read all prefixes — they are k-anonymous by design, document this in the JSDoc). In `breachResultsRepository.ts`: writes set `userId`; per-user reads filter on it. Update their call sites (`unlockBreachRefresh.ts`, `CredentialRepositoryImpl`, SecurityAuditPage) to pass the current user id.

- [ ] **Step 6: Update all call sites**

Enumerate every caller:

```bash
grep -rn "credentialRepository\.\(create\|findAll\|findById\|update\|delete\|search\|findByCategory\|findFavorites\|exportAll\|importFromJson\|save\)" src --include="*.ts" --include="*.tsx" | grep -v __tests__
```

For each hit (expected: DashboardPage, AddCredentialPage, EditCredentialPage, CredentialDetailsDialog/Page, FavoritesPage, SecurityAuditPage, ImportDialog, ExportDialog, unlockBreachRefresh, credentialStore), pass the authenticated user's id from the auth store, e.g.:

```typescript
const { user, vaultKey } = useAuthStore();
// ...
const credentials = await credentialRepository.findAll(vaultKey, user.id);
```

Where `user` may be null, guard first (these flows already guard on `vaultKey`).

- [ ] **Step 7: Run the isolation test until green, then the existing credential suites**

Run: `npx vitest run src/data/repositories/__tests__/userIsolation.test.ts src/data/repositories/__tests__/ src/test/integration.test.ts`
Expected: all PASS (existing suites updated for the new arity as part of Step 6).

- [ ] **Step 8: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/data src/core/breach --max-warnings 0
git add -A src docs
git commit -m "feat(security): partition credentials/breach data by userId (DB v9, Finding 1)

Two-user isolation enforced at the repository layer; legacy rows lazily
claimed via successful AES-GCM decryption. Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Persist only a minimal auth shell; wipe old secret-bearing snapshots

**Files:**
- Modify: `src/presentation/store/authStore.ts:97-104`
- Modify: `src/presentation/App.tsx` (rehydrate full user from IndexedDB on boot)
- Test: `src/presentation/store/__tests__/authStorePersistence.test.ts` (new)

- [ ] **Step 1: Write the failing persistence test**

```typescript
// src/presentation/store/__tests__/authStorePersistence.test.ts
/**
 * The localStorage auth snapshot must never contain offline-attack
 * material (Finding 2): no hashedMasterPassword, encryptedVaultKey,
 * salt, or webAuthnCredentials. Old snapshots must be stripped on load.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/presentation/store/authStore';
import type { User } from '@/domain/entities/User';

const fullUser: User = {
  id: 'u1',
  username: 'alice',
  displayName: 'Alice',
  hashedMasterPassword: 'scrypt$...secret...',
  encryptedVaultKey: '{"ciphertext":"..."}',
  salt: 'c2FsdA==',
  biometricEnabled: true,
  webAuthnCredentials: [
    { id: 'cred1', publicKey: 'pk', counter: 1, createdAt: new Date(),
      vaultKeyScheme: 'prf-v1', wrappedVaultKey: '{"ct":"..."}', prfSalt: 'cHJm' },
  ],
  createdAt: new Date(),
  lastLoginAt: new Date(),
  securitySettings: {
    sessionTimeoutMinutes: 15, requireBiometric: false, clipboardClearSeconds: 30,
    showPasswordStrength: true, enableSecurityAudit: true,
    passwordGenerationLength: 20, twoFactorEnabled: false,
  },
};

const SENSITIVE = ['hashedMasterPassword', 'encryptedVaultKey', 'salt',
                   'webAuthnCredentials', 'wrappedVaultKey', 'prfSalt'];

describe('auth persistence minimization', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('persists only the {id, username, displayName} shell', async () => {
    useAuthStore.getState().setUser(fullUser);
    await useAuthStore.persist.rehydrate(); // flush write
    const raw = localStorage.getItem('trustvault-auth') ?? '';
    for (const field of SENSITIVE) {
      expect(raw).not.toContain(field);
    }
    expect(raw).toContain('"id":"u1"');
    expect(raw).toContain('"username":"alice"');
  });

  it('migrates a v0 snapshot by stripping all sensitive fields', async () => {
    localStorage.setItem('trustvault-auth', JSON.stringify({
      state: { user: { ...fullUser, createdAt: 0, lastLoginAt: 0 }, isAuthenticated: true },
      version: 0,
    }));
    await useAuthStore.persist.rehydrate();
    const raw = localStorage.getItem('trustvault-auth') ?? '';
    for (const field of SENSITIVE) {
      expect(raw).not.toContain(field);
    }
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/presentation/store/__tests__/authStorePersistence.test.ts`
Expected: FAIL — first test finds `hashedMasterPassword` in the snapshot.

- [ ] **Step 3: Implement the minimal-shell persist config**

In `src/presentation/store/authStore.ts`, replace the persist options object (lines 97-104):

```typescript
/** What survives a page reload — never any key/hash/wrap material. */
interface PersistedAuthShell {
  user: Pick<User, 'id' | 'username' | 'displayName'> | null;
  isAuthenticated: boolean;
}

const toShell = (user: User | null): PersistedAuthShell['user'] =>
  user
    ? {
        id: user.id,
        ...(user.username !== undefined ? { username: user.username } : {}),
        ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
      }
    : null;
```

and in the persist options:

```typescript
    {
      name: 'trustvault-auth',
      version: 1,
      partialize: (state): PersistedAuthShell => ({
        // Shell only: full User (hash, encrypted vault key, salt, WebAuthn
        // wrap material) stays in IndexedDB and is refetched by App on boot.
        user: toShell(state.user),
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persisted): PersistedAuthShell => {
        // v0 snapshots stored the full User — strip to the shell and let the
        // overwrite-on-save remove the old secret-bearing copy.
        const old = persisted as { user?: User | null; isAuthenticated?: boolean };
        return {
          user: toShell(old.user ?? null),
          isAuthenticated: old.isAuthenticated ?? false,
        };
      },
    }
```

Note: after rehydrate, `state.user` is a partial `User`. Type it honestly: change `AuthState.user` to `User | PersistedAuthShell['user'] | null` is invasive — instead keep `User | null` and have App immediately replace the shell with the full record (Step 4). Components must not read beyond `id/username/displayName` before that happens; the vault is locked at that point anyway (vaultKey is never persisted).

- [ ] **Step 4: Refetch the full user on app boot**

In `src/presentation/App.tsx`, inside the existing initialization `useEffect` (after `initializeDatabase()` resolves):

```typescript
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import { useAuthStore } from '@/presentation/store/authStore';

// inside the init effect, after DB init:
const { user, isAuthenticated, setUser, logout } = useAuthStore.getState();
if (isAuthenticated && user?.id) {
  const full = await userRepository.findById(user.id);
  if (full && mounted) {
    setUser(full);
  } else if (mounted) {
    logout(); // stale shell pointing at a deleted user
  }
}
```

- [ ] **Step 5: Run tests until green**

Run: `npx vitest run src/presentation/store/__tests__/authStorePersistence.test.ts src/presentation/store/__tests__/authStore.test.ts`
Expected: PASS (19 existing authStore tests must stay green).

- [ ] **Step 6: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/presentation/store src/presentation/App.tsx --max-warnings 0
git add -A src
git commit -m "fix(security): persist only auth shell, migrate away secret-bearing snapshots (Finding 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Bind vault-key wrapping to scrypt (memory-hard), transparent upgrade

**Files:**
- Modify: `src/core/crypto/encryption.ts` (add `deriveVaultWrapKey`)
- Modify: `src/data/storage/database.ts` (`StoredUser` gains `vaultKdf`)
- Modify: `src/data/repositories/UserRepositoryImpl.ts` (lines 38, 121, 379, 482/489)
- Test: `src/core/crypto/__tests__/vaultWrapKdf.test.ts` (new)

- [ ] **Step 1: Write the failing KDF tests**

```typescript
// src/core/crypto/__tests__/vaultWrapKdf.test.ts
/**
 * Finding 3: the offline-attackable artifact is encryptedVaultKey, so the
 * wrap key must come from the memory-hard scrypt KDF (S4 params), not
 * PBKDF2. Legacy PBKDF2-wrapped users upgrade transparently on login.
 */
import { describe, it, expect } from 'vitest';
import { deriveVaultWrapKey, deriveKeyFromPassword, encrypt, decrypt } from '@/core/crypto/encryption';

describe('deriveVaultWrapKey (scrypt-v1)', () => {
  const salt = new Uint8Array(32).fill(7);

  it('round-trips an AES-GCM payload', async () => {
    const key = await deriveVaultWrapKey('correct horse battery staple', salt);
    const ct = await encrypt('vault-key-bytes-b64', key);
    expect(await decrypt(ct, key)).toBe('vault-key-bytes-b64');
  });

  it('is deterministic for same password+salt and differs across passwords', async () => {
    const k1 = await deriveVaultWrapKey('pw-one-是-long-enough', salt);
    const k2 = await deriveVaultWrapKey('pw-one-是-long-enough', salt);
    const k3 = await deriveVaultWrapKey('pw-two-completely-diff', salt);
    const ct = await encrypt('probe', k1);
    expect(await decrypt(ct, k2)).toBe('probe');          // same inputs → same key
    await expect(decrypt(ct, k3)).rejects.toThrow();       // different pw → auth failure
  });

  it('produces a different key than the legacy PBKDF2 derivation', async () => {
    const scryptKey = await deriveVaultWrapKey('same-password-here', salt);
    const pbkdf2Key = await deriveKeyFromPassword('same-password-here', salt);
    const ct = await encrypt('probe', scryptKey);
    await expect(decrypt(ct, pbkdf2Key)).rejects.toThrow();
  });

  it('returns a non-extractable AES-GCM key', async () => {
    const key = await deriveVaultWrapKey('pw', salt);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/crypto/__tests__/vaultWrapKdf.test.ts`
Expected: FAIL — `deriveVaultWrapKey` is not exported.

- [ ] **Step 3: Implement `deriveVaultWrapKey` in `src/core/crypto/encryption.ts`**

```typescript
import { scrypt } from '@noble/hashes/scrypt';

/**
 * Derives the vault-key wrap key from the master password using scrypt
 * (S4 params: N=2^17, r=8, p=1 — the same cost as login verification).
 *
 * Finding 3 (2026-06-11): encryptedVaultKey is the artifact an offline
 * attacker actually attacks; wrapping it under PBKDF2 made the weaker KDF
 * the real vault KDF. scrypt's memory hardness now bounds offline guessing.
 * The derived bytes are zeroized after import; the key is non-extractable.
 */
export async function deriveVaultWrapKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const derived = scrypt(password, salt, { N: 131072, r: 8, p: 1, dkLen: 32 });
  try {
    return await crypto.subtle.importKey(
      'raw',
      derived,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } finally {
    derived.fill(0);
  }
}
```

- [ ] **Step 4: Run Step 1 tests — PASS expected**

Run: `npx vitest run src/core/crypto/__tests__/vaultWrapKdf.test.ts`

- [ ] **Step 5: Add the `vaultKdf` marker and write the migration test**

In `database.ts`, on `StoredUser`:

```typescript
  /**
   * KDF that wraps encryptedVaultKey. Absent = legacy PBKDF2-600k
   * (upgraded transparently on next successful password login).
   */
  vaultKdf?: 'scrypt-v1';
```

Append to `src/data/repositories/__tests__/UserRepositoryImpl.test.ts`:

```typescript
describe('vault KDF binding (Finding 3)', () => {
  it('new users wrap the vault key under scrypt-v1', async () => {
    await userRepository.createUser('kdfuser', 'a-strong-master-pw-123', undefined);
    const stored = await db.users.where('usernameLower').equals('kdfuser').first();
    expect(stored?.vaultKdf).toBe('scrypt-v1');
  });

  it('legacy PBKDF2 users still log in and are upgraded in place', async () => {
    await userRepository.createUser('legacyuser', 'a-strong-master-pw-123', undefined);
    const stored = await db.users.where('usernameLower').equals('legacyuser').first();
    if (!stored) throw new Error('setup failed');

    // Rewrite the row as a legacy PBKDF2-wrapped user.
    const salt = Uint8Array.from(atob(stored.salt), (c) => c.charCodeAt(0));
    const legacyWrap = await deriveKeyFromPassword('a-strong-master-pw-123', salt);
    const vaultKeyB64 = await decrypt(
      JSON.parse(stored.encryptedVaultKey),
      await deriveVaultWrapKey('a-strong-master-pw-123', salt)
    );
    const reWrapped = await encrypt(vaultKeyB64, legacyWrap);
    await db.users.update(stored.id, {
      encryptedVaultKey: JSON.stringify(reWrapped),
      vaultKdf: undefined,
    });

    const session = await userRepository.authenticateWithPassword(
      'legacyuser',
      'a-strong-master-pw-123'
    );
    expect(session.vaultKey).toBeInstanceOf(CryptoKey);

    const upgraded = await db.users.where('usernameLower').equals('legacyuser').first();
    expect(upgraded?.vaultKdf).toBe('scrypt-v1');
  });
});
```

Run it — Expected: FAIL (`vaultKdf` never set).

- [ ] **Step 6: Switch the four wrap sites in `UserRepositoryImpl.ts`**

1. `createUser` (line 38): replace `deriveKeyFromPassword` with `deriveVaultWrapKey`; add `vaultKdf: 'scrypt-v1'` to the `storedUser` literal.
2. `authenticateWithPassword` (line 121): branch on the marker, upgrading legacy rows after a successful decrypt (mirror of the `needsRehash` block at line 110):

```typescript
    const salt = Uint8Array.from(atob(storedUser.salt), (c) => c.charCodeAt(0));
    const isScryptWrapped = storedUser.vaultKdf === 'scrypt-v1';
    const tempKey = isScryptWrapped
      ? await deriveVaultWrapKey(masterPassword, salt)
      : await deriveKeyFromPassword(masterPassword, salt); // legacy PBKDF2

    const encryptedVaultKeyData = JSON.parse(storedUser.encryptedVaultKey);
    const masterVaultKeyBase64 = await decrypt(encryptedVaultKeyData, tempKey);

    // Transparent KDF upgrade (Finding 3). Best-effort: never blocks login.
    if (!isScryptWrapped) {
      try {
        const upgradedWrapKey = await deriveVaultWrapKey(masterPassword, salt);
        const upgradedCiphertext = await encrypt(masterVaultKeyBase64, upgradedWrapKey);
        await db.users.update(storedUser.id, {
          encryptedVaultKey: JSON.stringify(upgradedCiphertext),
          vaultKdf: 'scrypt-v1',
        });
      } catch {
        /* legacy wrap remains valid */
      }
    }
```

3. Biometric-enrollment password confirmation (line 379): same branch-on-marker when decrypting the stored vault key.
4. `changeMasterPassword` (lines 482/489): decrypt with the marker-selected KDF for the current password; always wrap with `deriveVaultWrapKey` for the new password and set `vaultKdf: 'scrypt-v1'`.

- [ ] **Step 7: Run the full crypto/auth suites**

Run: `npx vitest run src/core/crypto src/data/repositories/__tests__/UserRepositoryImpl.test.ts src/test/integration.test.ts`
Expected: all PASS, including the 20 ZK-invariant integration tests.

- [ ] **Step 8: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/crypto src/data --max-warnings 0
git add -A src
git commit -m "feat(security): wrap vault key under scrypt (scrypt-v1), transparent legacy upgrade (Finding 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Gate browser-credential storage behind the autofill opt-in

**Files:**
- Modify: `src/presentation/pages/AddCredentialPage.tsx:224-239`
- Modify: `src/presentation/pages/EditCredentialPage.tsx:281-295`
- Modify: `AUTOFILL_INTEGRATION.md` (activation criteria section)
- Test: `src/core/autofill/__tests__/autofillGating.test.ts` (new)

- [ ] **Step 1: Write the failing gating test**

```typescript
// src/core/autofill/__tests__/autofillGating.test.ts
/**
 * Finding 5: pushing decrypted passwords into the browser's Credential
 * Management store must require the explicit autofill opt-in
 * (DEFAULT_AUTOFILL_SETTINGS.enabled === false) and a per-origin allow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldStoreInBrowser } from '../credentialManagementService';
import { DEFAULT_AUTOFILL_SETTINGS, saveAutofillSettings } from '../autofillSettings';

describe('shouldStoreInBrowser', () => {
  beforeEach(() => localStorage.clear());

  it('is false by default (autofill is opt-in)', () => {
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(false);
  });

  it('is true once autofill is enabled for an allowed HTTPS origin', () => {
    saveAutofillSettings({ ...DEFAULT_AUTOFILL_SETTINGS, enabled: true });
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(true);
  });

  it('respects per-origin exclusions and the HTTPS-only rule', () => {
    saveAutofillSettings({
      ...DEFAULT_AUTOFILL_SETTINGS,
      enabled: true,
      excludedOrigins: ['https://example.com'],
    });
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(false);
    expect(shouldStoreInBrowser('http://plain.example/login')).toBe(false);
  });

  it('is false for malformed URLs', () => {
    saveAutofillSettings({ ...DEFAULT_AUTOFILL_SETTINGS, enabled: true });
    expect(shouldStoreInBrowser('not a url')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `shouldStoreInBrowser` not exported.

- [ ] **Step 3: Implement the gate in `credentialManagementService.ts`**

```typescript
import { isAutofillEnabledForOrigin, loadAutofillSettings } from './autofillSettings';

/**
 * Single decision point for whether a credential may be handed to the
 * browser's Credential Management store. Requires the global opt-in
 * (off by default) plus the per-origin allow/HTTPS rules.
 */
export function shouldStoreInBrowser(credentialUrl: string): boolean {
  const origin = extractOrigin(credentialUrl);
  if (!origin) return false;
  return isAutofillEnabledForOrigin(origin, loadAutofillSettings());
}
```

- [ ] **Step 4: Apply the gate at both call sites**

In `AddCredentialPage.tsx` (and identically in `EditCredentialPage.tsx`), extend the existing condition:

```typescript
      if (
        credential.category === 'login' &&
        credential.url &&
        shouldStoreInBrowser(credential.url) &&
        isCredentialManagementSupported()
      ) {
```

(import `shouldStoreInBrowser` alongside the existing autofill imports).

- [ ] **Step 5: Document extension activation criteria**

In `AUTOFILL_INTEGRATION.md`, add under the security section:

```markdown
### Extension Fill-Path Activation Criteria (X1 follow-up)

The extension's fill path stays **inert** (GET_CREDENTIALS returns `[]`) until all of:
1. **Authenticated channel** — PWA↔extension messaging with mutual verification
   (e.g. `externally_connectable` restricted to the TrustVault origin + per-install
   pairing secret), never a shared plaintext store.
2. **Per-origin consent** — user explicitly allows each origin before any
   credential for it is exposed (KeePassXC host allow/deny model).
3. **Per-fill confirmation** — explicit user gesture before injecting into a form
   (no silent fills), honoring `requireConfirmation`.
```

- [ ] **Step 6: Run tests** — `npx vitest run src/core/autofill` → all PASS (including the 17 matcher + 15 settings tests).

- [ ] **Step 7: Type-check, lint, commit**

```bash
npm run type-check && npx eslint src/core/autofill src/presentation/pages/AddCredentialPage.tsx src/presentation/pages/EditCredentialPage.tsx --max-warnings 0
git add -A src AUTOFILL_INTEGRATION.md
git commit -m "fix(security): gate browser credential storage behind autofill opt-in (Finding 5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Reframe local rate limiting as UX hardening, not a security boundary

**Files:**
- Modify: `src/core/auth/rateLimiter.ts:1` (header comment)
- Modify: `SECURITY.md`, `SECURITY_AUDIT_REPORT.md` (M1 wording)

- [ ] **Step 1: Update the module header**

Replace the top of `rateLimiter.ts` with:

```typescript
/**
 * Local login rate limiter — UX hardening, NOT a security boundary.
 *
 * Lockout state lives in the local `loginAttempts` Dexie table; anyone with
 * storage access can clear it, and offline attacks on the stored verifier /
 * encryptedVaultKey bypass app code entirely. The real brute-force defenses
 * are the scrypt KDF cost (N=2^17) and master-password strength — the same
 * trust model as KeePassXC's local vault. This limiter only slows casual
 * online guessing through the UI and gives honest users decay/backoff UX.
 */
import { db } from '@/data/storage/database';
```

- [ ] **Step 2: Align the docs**

In `SECURITY.md` and `SECURITY_AUDIT_REPORT.md` (M1 section), find the rate-limiting claims and append one sentence: "Local rate limiting is UX-layer mitigation only — it is clearable by anyone with storage access; offline resistance comes from scrypt cost and password strength."

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run src/core/auth/__tests__/rateLimiter.test.ts && npm run type-check
git add src/core/auth/rateLimiter.ts SECURITY.md SECURITY_AUDIT_REPORT.md
git commit -m "docs(security): scope local rate limiting as UX hardening (Finding 4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Remove stale argon2.wasm and fix KDF doc drift

**Files:**
- Delete: `src/assets/argon2.wasm`
- Modify: `src/domain/entities/User.ts:16`
- Modify: `CLAUDE.md` (scrypt params, two places)

- [ ] **Step 1: Confirm zero references, then delete**

```bash
grep -rn "argon2.wasm\|assets/argon2" src vite.config.ts package.json index.html public 2>/dev/null
# Expected: no output
git rm src/assets/argon2.wasm
rmdir src/assets 2>/dev/null || true
```

- [ ] **Step 2: Fix the false comments**

`User.ts:16`: change `hashedMasterPassword: string; // Argon2id hash` to:

```typescript
  hashedMasterPassword: string; // scrypt hash (N=2^17, r=8, p=1 — see core/crypto/password.ts)
```

`CLAUDE.md`: both scrypt parameter mentions say `N=32768`; the code (password.ts:17, S4) is `N=131072 (2^17)`. Update both to `(N=131072 (2^17), r=8, p=1, dkLen=32)`.

- [ ] **Step 3: Verify build integrity and commit**

```bash
npm run type-check && npm run build 2>&1 | tail -3
git add -A
git commit -m "chore(security): remove stale argon2.wasm, fix scrypt param doc drift (Finding 6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Documentation sync + final verification (Definition of Done)

**Files:**
- Modify: `TEST_STATUS.md` (new dated section), `SECURITY_AUDIT_REPORT.md` (Patch Notes), `SECURITY.md`, `ROADMAP.md` (scope shift), `GAP_ANALYSIS.md` (finding statuses)

- [ ] **Step 1: Full verification battery**

```bash
npm run type-check                      # 0 errors
npm run lint 2>&1 | tail -1             # ≤ 855 problems (no new vs baseline)
npx vitest run src                      # all suites; no new failures vs TEST_STATUS.md baseline
```

- [ ] **Step 2: Record results**

Add a `## Security Findings Remediation (F1–F6) — <date>` section to `TEST_STATUS.md` listing the new suites (userIsolation, authStorePersistence, vaultWrapKdf, autofillGating) with pass counts and the verification checklist. Add a matching `## Patch Notes — <date>` block to `SECURITY_AUDIT_REPORT.md` covering: DB v9 partitioning, auth-shell persistence + snapshot migration, scrypt-v1 vault wrap, autofill gating, rate-limiter reframing, argon2.wasm removal. Update `GAP_ANALYSIS.md` finding statuses.

- [ ] **Step 3: Refresh the knowledge graph and commit**

```bash
graphify update .
git add -A
git commit -m "docs: record security findings remediation (F1–F6) across status docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Risks & Decisions Locked In

1. **Lazy-claim over hard migration (Task 1):** multi-user DBs cannot attribute legacy rows offline; AES-GCM decryption success is cryptographic proof of ownership, so claiming on first successful decrypt is both safe and total. Single-user DBs (the overwhelming case) are backfilled eagerly in the v9 upgrade.
2. **Same error for "missing" and "not yours" (Task 1):** `update`/`delete` throw identical `Credential not found` errors to avoid an existence oracle.
3. **Persist shell keeps `user` slot shape (Task 2):** avoids a store-wide type refactor; App's boot refetch replaces the shell before any unlocked-state UI reads deep fields. Vault key was never persisted, so pre-refetch state is always locked.
4. **scrypt for wrap, not Argon2id (Task 3):** Argon2 was deliberately removed (CSP/WASM, P5). scrypt at S4 params is the strongest KDF already in the bundle; reusing it keeps one cost story (and one upgrade path) instead of reintroducing WASM.
5. **Service worker reads breach prefixes un-scoped (Task 1/Step 5):** while locked there is no user context; prefixes are k-anonymous by design (documented residual in SECURITY.md), so cross-user prefix prefetch leaks nothing new.
