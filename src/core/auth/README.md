# Core: Authentication (`src/core/auth/`)

## Purpose

Provides cryptographically secure authentication primitives:
- WebAuthn biometric registration & verification (PRF-enabled)
- TOTP/2FA code generation & validation
- Master password hashing (Scrypt)
- Backup code generation & consumption
- Database migration helpers for auth schemes

## Public API

### WebAuthn (Biometric Vault Key Wrapping — S1)

```typescript
import { wrapVaultKeyWithPRF, unwrapVaultKeyWithPRF } from '@/core/auth';

// Register biometric authenticator
const { credentialId, challenge } = await registerBiometric(userName);

// Unlock vault using biometric + PRF
const sessionVaultKey = await unwrapVaultKeyWithPRF(
  wrappedVaultKeyFromStorage,
  prfOutput // from WebAuthn PRF extension
);
```

**Invariants:**
- Vault key is NEVER extractable (non-extractable CryptoKey, S7)
- Biometric enrollment MUST verify master password first (security S1)
- PRF-wrapped keys are zero-knowledge: PRF output is never stored

**Example test:**
```typescript
test('unwrapVaultKeyWithPRF produces non-extractable key', async () => {
  const wrapped = await wrapVaultKeyWithPRF(vaultKey, prfOutput);
  const unwrapped = await unwrapVaultKeyWithPRF(wrapped, prfOutput);
  expect(unwrapped.extractable).toBe(false);
});
```

---

### TOTP / 2FA

```typescript
import { generateTOTP, generateTOTPSecret } from '@/core/auth';

// Generate secret for new 2FA enrollment
const secret = generateTOTPSecret();

// Generate 6-digit code
const code = generateTOTP(secret); // e.g., "123456"

// Verify user-entered code (30s window)
const isValid = verifyTOTP(userCode, secret);
```

**Invariants:**
- TOTP uses HMAC-SHA1, 30-second period, 6 digits (RFC 6238)
- Secrets are Base32-encoded (RFC 4648)

---

### Backup Codes

```typescript
import { generateBackupCodes, consumeBackupCode } from '@/core/auth';

// Generate 10 single-use codes
const codes = generateBackupCodes();
// → ["ABC123", "DEF456", ...] (each usable once)

// Verify & consume a code
const valid = consumeBackupCode('ABC123', storedCodesSet);
// → true if valid & not consumed; code is now marked consumed
```

**Invariants:**
- Each code is single-use
- Codes are case-insensitive, whitespace-trimmed
- Storage tracks consumed codes (don't re-consume)

---

### Database Migrations

```typescript
import { stripLegacyBiometric, deriveUniqueUsernames } from '@/core/auth';

// Migration: Remove non-PRF biometric credentials (DB v6→v7)
const result = stripLegacyBiometric(credential);
// → { isPrf: true/false, credential: updated }

// Migration: Derive unique usernames from email (DB v5→v6)
const assignments = deriveUniqueUsernames(users);
// → [{ userId, username }, ...]
```

---

## Design Notes

### Why Scrypt instead of Argon2?

- **Argon2id** requires WASM (CSP violation, offline complexity)
- **Scrypt** is in `@noble/hashes`, browser-native
- Parameters: N=131072 (memory-hard), r=8, p=1, dkLen=32 (OWASP 2025)
- Master password → 32-byte hash → PBKDF2 (600k iterations) → session vault key

### Why PRF for Biometric?

- **Zero-knowledge:** PRF output is never stored
- **Device-bound:** Decryption only works on the device where biometric is enrolled
- **Fallback:** Non-PRF credentials fall back to master password unlock (for older browsers)
- **Scheme:** `vaultKeyScheme: 'prf-v1'` in credential

---

## Import Rules

✅ **Can import from:**
- `@/domain/entities/` — User, Credential types
- `@/core/crypto/` — encrypt, decrypt, deriveKeyFromPassword
- `@/core/utils/` — base64 utilities

❌ **Cannot import from:**
- `@/data/`, `@/presentation/` — this is dependency-free core

---

## Testing

**Location:** Colocated `.test.ts` files in same directory

**Example:** `src/core/auth/webauthn.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { wrapVaultKeyWithPRF, unwrapVaultKeyWithPRF } from './index';

describe('biometric vault key', () => {
  it('PRF-wrapped key is non-extractable', async () => {
    // Test code here
  });
});
```

**Run tests:**
```bash
npm run test -- src/core/auth
```

---

## Checklist for New Auth Code

- [ ] Non-extractable CryptoKey objects (S7)
- [ ] No sensitive data in console logs
- [ ] Offline-first: graceful degradation if crypto fails
- [ ] TypeScript strict mode (no `any`)
- [ ] Test coverage ≥80%
- [ ] Documentation of invariants (comments on WHY, not WHAT)
- [ ] Zod validation for imported data (S8)
