# Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IndexedDB-backed exponential-backoff rate limiting to master password authentication, preventing brute-force attacks via the sign-in and unlock forms.

**Architecture:** A new `loginAttempts` Dexie table (DB version 4) stores per-email attempt counts and lockout expiry. A pure `rateLimiter.ts` module exposes three functions (`checkRateLimit`, `recordFailedAttempt`, `clearAttempts`) called from `UserRepositoryImpl.authenticateWithPassword()` before and after the existing Scrypt verification.

**Tech Stack:** TypeScript 5.7 strict, Dexie 4 (IndexedDB), Vitest, React 19 / Vite 6.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/data/storage/database.ts` | Add `StoredLoginAttempt` interface, `loginAttempts` Table declaration, version-4 migration, and wipe in `clearAll()` |
| Create | `src/core/auth/rateLimiter.ts` | `checkRateLimit`, `recordFailedAttempt`, `clearAttempts` — no state, pure DB reads/writes |
| Create | `src/core/auth/__tests__/rateLimiter.test.ts` | Unit tests for all three functions and all lockout thresholds |
| Modify | `src/data/repositories/UserRepositoryImpl.ts` | Wire rate limiter into `authenticateWithPassword()` |

---

## Task 1: Add `loginAttempts` table to the database (DB version 4)

**Files:**
- Modify: `src/data/storage/database.ts`

- [ ] **Step 1: Add the `StoredLoginAttempt` interface**

In `src/data/storage/database.ts`, after the `StoredBreachResult` interface (around line 70), add:

```typescript
export interface StoredLoginAttempt {
  email: string;        // primary key
  attempts: number;
  lockedUntil: number;  // epoch ms; 0 = not locked
  lastAttemptAt: number;
}
```

- [ ] **Step 2: Declare the table property on `TrustVaultDB`**

In the class body (around line 81), after `breachResults!: Table<StoredBreachResult, string>;`, add:

```typescript
loginAttempts!: Table<StoredLoginAttempt, string>;
```

- [ ] **Step 3: Add the version-4 migration**

After the closing brace of `this.version(3)...` block (around line 129), add:

```typescript
    // Version 4 - Add login attempts table for brute-force rate limiting
    this.version(4).stores({
      credentials: credentialStoreSchema,
      users: userStoreSchema,
      sessions: sessionStoreSchema,
      settings: 'id',
      breachResults: breachStoreSchema,
      loginAttempts: 'email, lockedUntil',
    });
```

- [ ] **Step 4: Wipe `loginAttempts` in `clearAll()`**

In `clearAll()` (around line 135), add one line after `await this.breachResults.clear();`:

```typescript
    await this.loginAttempts.clear();
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/storage/database.ts
git commit -m "feat(db): add loginAttempts table for rate limiting (v4)"
```

---

## Task 2: Write failing tests for the rate limiter

**Files:**
- Create: `src/core/auth/__tests__/rateLimiter.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/core/auth/__tests__/rateLimiter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/storage/database';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
} from '../rateLimiter';

const EMAIL = 'test@example.com';

beforeEach(async () => {
  await db.loginAttempts.clear();
});

describe('checkRateLimit', () => {
  it('does not throw when no attempts recorded', async () => {
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('does not throw when attempts < 5', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 4,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('throws when account is locked and lockout has not expired', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 5,
      lockedUntil: Date.now() + 60_000, // locked for 60s
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).rejects.toThrow(/Too many failed attempts/);
  });

  it('does not throw when lockout has expired', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 5,
      lockedUntil: Date.now() - 1, // expired 1ms ago
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).resolves.toBeUndefined();
  });

  it('error message includes remaining minutes when locked', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 10,
      lockedUntil: Date.now() + 5 * 60_000,
      lastAttemptAt: Date.now(),
    });
    await expect(checkRateLimit(EMAIL)).rejects.toThrow(/5 minute/);
  });
});

describe('recordFailedAttempt', () => {
  it('creates a new record for first failure', async () => {
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(1);
    expect(record?.lockedUntil).toBe(0);
  });

  it('increments existing attempt count', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 3,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(4);
  });

  it('sets 30-second lockout at 5 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 4,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(5);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 29_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 31_000);
  });

  it('sets 5-minute lockout at 10 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 9,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(10);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 4 * 60_000);
    expect(record?.lockedUntil).toBeLessThanOrEqual(before + 6 * 60_000);
  });

  it('sets 30-minute lockout at 15 failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 14,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(15);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 29 * 60_000);
  });

  it('sets 1-hour lockout at 20+ failures', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 19,
      lockedUntil: 0,
      lastAttemptAt: Date.now(),
    });
    const before = Date.now();
    await recordFailedAttempt(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record?.attempts).toBe(20);
    expect(record?.lockedUntil).toBeGreaterThanOrEqual(before + 59 * 60_000);
  });
});

describe('clearAttempts', () => {
  it('removes the attempt record', async () => {
    await db.loginAttempts.put({
      email: EMAIL,
      attempts: 7,
      lockedUntil: Date.now() + 60_000,
      lastAttemptAt: Date.now(),
    });
    await clearAttempts(EMAIL);
    const record = await db.loginAttempts.get(EMAIL);
    expect(record).toBeUndefined();
  });

  it('does not throw when no record exists', async () => {
    await expect(clearAttempts(EMAIL)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests — confirm they all fail with import errors**

```bash
npm run test -- src/core/auth/__tests__/rateLimiter.test.ts --run
```

Expected: All tests fail with `Cannot find module '../rateLimiter'` or similar. This is the correct TDD starting state.

---

## Task 3: Implement `rateLimiter.ts`

**Files:**
- Create: `src/core/auth/rateLimiter.ts`

- [ ] **Step 1: Create the module**

```typescript
// src/core/auth/rateLimiter.ts
import { db } from '@/data/storage/database';

const THRESHOLDS: Array<{ minAttempts: number; lockMs: number }> = [
  { minAttempts: 20, lockMs: 60 * 60_000 },       // 1 hour
  { minAttempts: 15, lockMs: 30 * 60_000 },       // 30 minutes
  { minAttempts: 10, lockMs:  5 * 60_000 },       // 5 minutes
  { minAttempts:  5, lockMs:       30_000 },       // 30 seconds
];

function lockoutMs(attempts: number): number {
  for (const { minAttempts, lockMs } of THRESHOLDS) {
    if (attempts >= minAttempts) return lockMs;
  }
  return 0;
}

function formatRemaining(lockedUntil: number): string {
  const ms = lockedUntil - Date.now();
  if (ms <= 0) return '0 seconds';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 1) {
    const seconds = Math.ceil(ms / 1_000);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

export async function checkRateLimit(email: string): Promise<void> {
  const record = await db.loginAttempts.get(email);
  if (!record) return;
  if (record.lockedUntil > 0 && Date.now() < record.lockedUntil) {
    throw new Error(
      `Too many failed attempts. Try again in ${formatRemaining(record.lockedUntil)}.`
    );
  }
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const existing = await db.loginAttempts.get(email);
  const attempts = (existing?.attempts ?? 0) + 1;
  const ms = lockoutMs(attempts);
  await db.loginAttempts.put({
    email,
    attempts,
    lockedUntil: ms > 0 ? Date.now() + ms : 0,
    lastAttemptAt: Date.now(),
  });
}

export async function clearAttempts(email: string): Promise<void> {
  await db.loginAttempts.delete(email);
}
```

- [ ] **Step 2: Run the tests — all should pass**

```bash
npm run test -- src/core/auth/__tests__/rateLimiter.test.ts --run
```

Expected: All tests pass. If any fail, fix `rateLimiter.ts` only — do not change the tests.

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/rateLimiter.ts src/core/auth/__tests__/rateLimiter.test.ts
git commit -m "feat(auth): add IndexedDB-backed rate limiter with exponential backoff"
```

---

## Task 4: Wire rate limiter into `UserRepositoryImpl.authenticateWithPassword()`

**Files:**
- Modify: `src/data/repositories/UserRepositoryImpl.ts`

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports (around line 11), add:

```typescript
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@/core/auth/rateLimiter';
```

- [ ] **Step 2: Wire the three calls into `authenticateWithPassword()`**

Replace the entire `authenticateWithPassword` method body (lines 79–124) with:

```typescript
  async authenticateWithPassword(email: string, masterPassword: string): Promise<AuthSession> {
    // Rate-limit check before the expensive Scrypt verification
    await checkRateLimit(email);

    // Find user by email
    const storedUser = await db.users.where('email').equals(email).first();
    if (!storedUser) {
      await recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }

    // Verify master password
    const isValid = await verifyPassword(masterPassword, storedUser.hashedMasterPassword);
    if (!isValid) {
      await recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }

    // Auth succeeded — clear any accumulated attempt record
    await clearAttempts(email);

    // Derive temporary key from password + salt (used to decrypt the vault key)
    const salt = Uint8Array.from(atob(storedUser.salt), c => c.charCodeAt(0));
    const tempKey = await deriveKeyFromPassword(masterPassword, salt);

    // Decrypt the actual vault key (masterVaultKey) from storage
    const encryptedVaultKeyData = JSON.parse(storedUser.encryptedVaultKey);
    const masterVaultKeyBase64 = await decrypt(encryptedVaultKeyData, tempKey);

    // Convert base64 master vault key to raw bytes
    const masterVaultKeyBytes = Uint8Array.from(atob(masterVaultKeyBase64), c => c.charCodeAt(0));

    // Import the raw master vault key as a CryptoKey
    const vaultKey = await crypto.subtle.importKey(
      'raw',
      masterVaultKeyBytes,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );

    // Update last login time
    await db.users.update(storedUser.id, {
      lastLoginAt: Date.now(),
    });

    // Create session with the actual vault key
    return {
      userId: storedUser.id,
      vaultKey,
      expiresAt: new Date(Date.now() + storedUser.securitySettings.sessionTimeoutMinutes * 60 * 1000),
      isLocked: false,
    };
  }
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: 0 errors.

- [ ] **Step 4: Run the full test suite**

```bash
npm run test -- --run
```

Expected: existing tests continue to pass; rate-limiter tests still pass. If integration tests that test `authenticateWithPassword` fail due to missing `loginAttempts` table in the test environment, see Step 5.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/data/repositories/UserRepositoryImpl.ts
git commit -m "feat(auth): wire rate limiting into authenticateWithPassword"
```

---

## Task 5: Verify end-to-end and update audit doc

- [ ] **Step 1: Build the app to confirm no production errors**

```bash
npm run build
```

Expected: build completes with 0 TypeScript errors and 0 lint warnings.

- [ ] **Step 2: Smoke-test manually in dev server**

```bash
npm run dev
```

1. Open http://localhost:3000
2. Sign in with a wrong password 5 times
3. Confirm the 6th attempt shows "Too many failed attempts. Try again in 30 seconds."
4. Sign in with the correct password after the lockout expires — confirm it succeeds and the next wrong attempt resets the counter.

- [ ] **Step 3: Update `SECURITY_AUDIT_REPORT.md`**

In the **Vulnerability Assessment → Medium: 2 Issues → M1: Rate Limiting Not Implemented** section, replace the block with:

```markdown
#### ~~M1: Rate Limiting Not Implemented~~ ✅ FIXED (May 14, 2026)
**Severity**: Medium  
**OWASP Category**: M3 (Insecure Authentication)  
**Fix**: `src/core/auth/rateLimiter.ts` — IndexedDB-backed exponential backoff.
Thresholds: 5 failures→30s, 10→5min, 15→30min, 20+→1hr.
Called from `UserRepositoryImpl.authenticateWithPassword()` before Scrypt verification.
Counter cleared on successful login.
```

Also update the medium issue count header from `### 🟡 Medium: 2 Issues` to `### 🟡 Medium: 1 Issue`.

- [ ] **Step 4: Final commit**

```bash
git add SECURITY_AUDIT_REPORT.md
git commit -m "docs(security): mark rate limiting as fixed in audit report"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] IndexedDB-backed storage — Task 1
- [x] `checkRateLimit` / `recordFailedAttempt` / `clearAttempts` — Task 3
- [x] Thresholds: 5→30s, 10→5min, 15→30min, 20+→1hr — Task 3 + tests in Task 2
- [x] Called before Scrypt in `authenticateWithPassword` — Task 4
- [x] `clearAll()` wipes `loginAttempts` — Task 1 Step 4
- [x] No UI changes required — confirmed (error flows through existing `error` state)
- [x] Tests for all thresholds + expired lockout + non-existent email — Task 2

**Placeholder scan:** None found.

**Type consistency:** `StoredLoginAttempt` defined in Task 1, imported via `db.loginAttempts` in Task 3 — consistent. `checkRateLimit`, `recordFailedAttempt`, `clearAttempts` named identically in Task 3 (implementation) and Task 4 (import + call sites).
