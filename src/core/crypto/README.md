# Core: Cryptography (`src/core/crypto/`)

## Purpose

Provides encryption/decryption and password hashing for vault security:
- **Master password** → Scrypt hash → PBKDF2 (600k iterations) → session vault key
- **Vault key** → AES-256-GCM encryption of credentials
- **Import/export** → Symmetric encryption with separate key derivation
- Non-extractable CryptoKey objects (S7)

## Public API

### Encryption (AES-256-GCM)

```typescript
import { encrypt, decrypt } from '@/core/crypto';

// Encrypt credential data with vault key
const encrypted = await encrypt(plaintext, vaultKey);
// → { ciphertext, iv, authTag } (base64-encoded)

// Decrypt credential
const plaintext = await decrypt(encrypted, vaultKey);
// → original plaintext string
```

**Invariants:**
- IV is random (96 bits)
- Auth tag verified on decryption (prevents tampering)
- vaultKey MUST be non-extractable CryptoKey (S7)

---

### Password Hashing (Scrypt + PBKDF2)

```typescript
import { hashPassword, verifyPassword } from '@/core/crypto';

// Hash master password (Scrypt)
const hash = await hashPassword(password);
// → { hash, salt } (both base64)

// Verify on sign-in
const isValid = await verifyPassword(password, storedHash, salt);
// → true/false

// Key derivation for session (PBKDF2)
const sessionKey = await deriveKeyFromPassword(password, salt);
// → CryptoKey (non-extractable, AES-GCM-capable)
```

**Invariants:**
- Scrypt: N=131072 (memory-hard), r=8, p=1, dkLen=32
- PBKDF2: 600,000 iterations (OWASP 2025), SHA-256, 32-byte key
- Salt: cryptographically random, unique per user

---

### Import/Export Encryption

```typescript
import { encryptExport, decryptImport } from '@/core/crypto';

// Encrypt vault for export
const encrypted = await encryptExport(credentials, exportPassword);
// → JSON with encrypted payload

// Decrypt imported vault
const credentials = await decryptImport(importedJson, userPassword);
// → Credential[] (metadata already sealed by S5)
```

---

## Design Notes

### Why Scrypt instead of Argon2?

- Argon2id requires WASM (CSP violation in offline context)
- Scrypt is in `@noble/hashes`, browser-native, memory-hard
- Parameters tuned for 2025 OWASP guidelines

### Non-Extractable Keys (S7)

All vault operations use non-extractable CryptoKey:

```typescript
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
  passwordKey,
  { name: 'AES-GCM', length: 256 },
  false, // ← extractable MUST be false
  ['encrypt', 'decrypt']
);
```

Why? If extractable=true, a malicious service worker could export the key to the network.

---

## Import Rules

✅ **Can import from:**
- `@/core/utils/` — base64 encoding
- `@/domain/entities/` — types only

❌ **Cannot import from:**
- `@/data/`, `@/presentation/`

---

## Testing

**Location:** Colocated `.test.ts` files

Example: `src/core/crypto/encryption.test.ts`

```typescript
test('encrypt/decrypt roundtrip', async () => {
  const plaintext = 'my-secret';
  const key = await deriveKeyFromPassword('password', salt);
  const encrypted = await encrypt(plaintext, key);
  const decrypted = await decrypt(encrypted, key);
  expect(decrypted).toBe(plaintext);
});

test('non-extractable vault key', async () => {
  const key = await deriveKeyFromPassword('password', salt);
  expect(key.extractable).toBe(false);
});
```

---

## Checklist for New Crypto Code

- [ ] Non-extractable CryptoKey objects (S7)
- [ ] IV randomness (96 bits for AES-GCM)
- [ ] Auth tag verification on decrypt
- [ ] Scrypt for master password (N=131072)
- [ ] PBKDF2 for session key (600k iterations)
- [ ] No sensitive data in console logs
- [ ] TypeScript strict mode
- [ ] Test coverage ≥90% (crypto is critical)
