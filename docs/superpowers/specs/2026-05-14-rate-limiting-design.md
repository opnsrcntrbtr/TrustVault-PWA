# Rate Limiting for Master Password Authentication

**Date**: 2026-05-14  
**Status**: Approved  
**OWASP**: M3 — Insecure Authentication  
**Severity**: Medium (highest unfixed issue in audit)

---

## Problem

`UserRepositoryImpl.authenticateWithPassword()` and the `UnlockPage` that calls it have zero brute-force protection. Scrypt at N=32768 costs ~100ms per attempt; without lockout, ~600 automated attempts per minute are possible against the unlock form. An attacker with local device access can enumerate weak master passwords without friction.

## Chosen Approach: IndexedDB-backed rate limiter (Option B)

A new `loginAttempts` Dexie table keyed by email. Survives page refresh (unlike an in-memory Map). Works for non-existent emails (prevents user-enumeration timing differences). Keeps security state cleanly separate from user data.

## Architecture

### New module: `src/core/auth/rateLimiter.ts`

Three pure async functions, no class, no state:

```
checkRateLimit(email)         → throws if locked (with time remaining)
recordFailedAttempt(email)    → increments counter; applies lockout at thresholds
clearAttempts(email)          → wipes record on successful login
```

Lockout thresholds (OWASP-aligned exponential backoff):
- 5 failures  → 30-second lockout
- 10 failures → 5-minute lockout
- 15 failures → 30-minute lockout
- 20+ failures → 1-hour lockout

Error message: `"Too many failed attempts. Try again in N minutes."` — never leaks whether email exists.

### DB change: `src/data/storage/database.ts`

Version 4 migration adds:
```ts
export interface StoredLoginAttempt {
  email: string;   // primary key (plaintext — same exposure as users table)
  attempts: number;
  lockedUntil: number; // epoch ms, 0 = not locked
  lastAttemptAt: number;
}
```
Index: `'email, lockedUntil'`

`clearAll()` also clears `loginAttempts` (security wipe).

### Call site: `UserRepositoryImpl.authenticateWithPassword()`

```
1. await checkRateLimit(email)          // fast, before expensive Scrypt hash
2. try authenticateWithPassword(...)
   → success: await clearAttempts(email)
   → failure: await recordFailedAttempt(email), re-throw unchanged error
```

**No UI changes needed** — `SigninPage` and `UnlockPage` already render `error` state; the lockout message flows through unchanged.

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/core/auth/rateLimiter.ts` | Create |
| `src/data/storage/database.ts` | Modify — add version 4, `StoredLoginAttempt`, `loginAttempts` table |
| `src/data/repositories/UserRepositoryImpl.ts` | Modify — wire `checkRateLimit` / `recordFailedAttempt` / `clearAttempts` |
| `src/core/auth/__tests__/rateLimiter.test.ts` | Create — unit tests |

## Testing

- Lockout triggers at the right thresholds (5, 10, 15, 20 failures)
- `checkRateLimit` throws with correct remaining-time message while locked
- `clearAttempts` resets counter after successful auth
- Lockout expires correctly after the window passes
- Non-existent email goes through the same code path (no early return)
- Successful login always clears counter

## Out of Scope

- Server-side rate limiting (no backend)
- Biometric authentication rate limiting (WebAuthn hardware handles replay protection via counter)
- Account recovery flow
- Admin unlock (no admin in local-only PWA)
