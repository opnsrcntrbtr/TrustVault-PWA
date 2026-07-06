# webauthn-prf-zktv Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TrustVault-PWA's inline WebAuthn-PRF ceremony and vault-key-wrapping code with the `webauthn-prf-zktv` npm package, with lazy migration of existing enrolled users.

**Architecture:** The package's `webauthn-prf-zktv/webauthn` module replaces the inline ceremonies (`registerCredentialWithPRF`/`getPRFOutput`) and detection; its core module replaces `biometricVaultKey.ts` (wrap/unwrap/serialize). `UserRepositoryImpl` orchestrates: enrollment stores a serialized v1 record in the existing Dexie `wrappedVaultKey` column; unlock reads both formats (`parseRecord` success = new, failure = legacy) and lazily migrates legacy records via `fromTrustVaultRecord` in the same ceremony. The master-password path is never touched.

**Tech Stack:** `webauthn-prf-zktv` (ESM, WebCrypto, `@noble/hashes`), Vitest, Dexie, React 19.

**Spec:** `docs/superpowers/specs/2026-07-06-webauthn-prf-zktv-refactor-design.md` — read it first.

**Deferred from spec (with reason):** the `readAuthenticatorFlags` BE/BS advisory signal — the package's high-level `evaluatePrf`/`unlockVault` seam does not expose the raw `authenticatorData`, so decoding the flags would require bypassing the ceremony composition this refactor exists to adopt. Revisit if/when the package surfaces flags in `PrfEvaluation` (candidate upstream feature request).

## Global Constraints

- TypeScript strict: `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are ON — build optional props conditionally (`...(x ? { x } : {})`), index access is `T | undefined`.
- Definition of done per task: `npm run type-check` (0 errors), `npm run lint` (0 warnings on touched files), targeted `npx vitest run <paths>` green.
- Never call `crypto.subtle.exportKey`; session vault keys stay non-extractable; zeroize transient key material in `finally` blocks; never log key material or error causes on the decrypt path.
- Path aliases: `@/` for `src/` (tsconfig + vite).
- User-facing error strings must match the existing copy verbatim (they are asserted in tests and referenced in docs).
- The package's browser module is imported via lazy `await import('webauthn-prf-zktv/webauthn')` inside `UserRepositoryImpl` methods (matching the existing lazy-import pattern) and statically inside `src/core/auth/webauthn.ts` (which is itself lazily imported where it matters).
- After each task's commit, if code changed run `graphify update .` (AST-only, no API cost).

---

### Task 1: Install the package + import smoke test

**Files:**
- Modify: `package.json` (dependency added by npm)
- Test: `src/core/auth/__tests__/zktvPackage.test.ts` (new, temporary smoke test)

**Interfaces:**
- Produces: `webauthn-prf-zktv` and `webauthn-prf-zktv/webauthn` importable everywhere; later tasks rely on these exact exports: `wrapSecret`, `unwrapSecret`, `parseRecord`, `serializeRecord`, `fromTrustVaultRecord`, `TRUSTVAULT_HKDF_INFO`, `deriveWrapKeyFromPrf`, `generateSalt`, `zeroize`, `ZktvError` (core) and `detectPrfSupport`, `isPrfViableOnThisClient`, `isWebAuthnSupported`, `enrollPrfCredential`, `evaluatePrf`, `readAuthenticatorFlags` (webauthn).

- [ ] **Step 1: Install**

```bash
npm install webauthn-prf-zktv
```

- [ ] **Step 2: Write the smoke test**

```ts
// src/core/auth/__tests__/zktvPackage.test.ts
import { describe, expect, it } from 'vitest';
import {
  generateSalt,
  parseRecord,
  serializeRecord,
  unwrapSecretBytes,
  wrapSecret,
  zeroize,
} from 'webauthn-prf-zktv';

describe('webauthn-prf-zktv package integration', () => {
  it('round-trips a prf-v1 wrap through serialize/parse', async () => {
    const prfOutput = generateSalt(32); // any 32 random bytes work as PRF output
    const prfSalt = generateSalt(32);
    const secret = new Uint8Array(32).fill(7);

    const record = await wrapSecret({ prfOutput, prfSalt, secret });
    expect(record.scheme).toBe('prf-v1');

    const reparsed = parseRecord(serializeRecord(record));
    const bytes = await unwrapSecretBytes({ record: reparsed, prfOutput });
    expect(Array.from(bytes)).toEqual(Array.from(secret));
    zeroize(bytes);
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/core/auth/__tests__/zktvPackage.test.ts`
Expected: PASS (proves ESM resolution, WebCrypto availability in the test env, and the API surface).

- [ ] **Step 4: Type-check and commit**

```bash
npm run type-check
git add package.json package-lock.json src/core/auth/__tests__/zktvPackage.test.ts
git commit -m "feat: add webauthn-prf-zktv dependency with integration smoke test"
```

---

### Task 2: Delegate PRF detection in `webauthn.ts` to the package

**Files:**
- Modify: `src/core/auth/webauthn.ts` (lines ~343–383: `PRFSupport`, `detectPRFSupport`, `isPRFSupported`; lines ~46–75: `isWebAuthnSupported`, `isBiometricAvailable`)
- Test: `src/core/auth/__tests__/webauthn.test.ts` (update detection tests)

**Interfaces:**
- Consumes: package `detectPrfSupport(): Promise<'supported' | 'unsupported' | 'unknown'>`, `isPrfViableOnThisClient(): Promise<{ viable: boolean; reason: string; environment: 'browser' | 'webview' }>`, `isWebAuthnSupported(): boolean`.
- Produces (unchanged public API — `BiometricSetupDialog.tsx` and `LoginPage.tsx` keep importing these): `detectPRFSupport(): Promise<PRFSupport>`, `isPRFSupported(): Promise<boolean>`, `isBiometricAvailable(): Promise<boolean>`, `type PRFSupport`.

- [ ] **Step 1: Update the detection tests to mock the package instead of `getClientCapabilities`**

In `src/core/auth/__tests__/webauthn.test.ts`, replace the `detectPRFSupport` describe block's capability stubs with a module mock:

```ts
import { vi } from 'vitest';

vi.mock('webauthn-prf-zktv/webauthn', () => ({
  detectPrfSupport: vi.fn(),
  isPrfViableOnThisClient: vi.fn().mockResolvedValue({
    viable: true,
    reason: 'ok',
    environment: 'browser',
  }),
  isWebAuthnSupported: vi.fn().mockReturnValue(true),
}));

import { detectPrfSupport, isPrfViableOnThisClient } from 'webauthn-prf-zktv/webauthn';
import { detectPRFSupport, isPRFSupported, isBiometricAvailable } from '@/core/auth/webauthn';

describe('PRF detection (delegated to webauthn-prf-zktv)', () => {
  it.each(['supported', 'unsupported', 'unknown'] as const)(
    'detectPRFSupport passes through %s',
    async (state) => {
      vi.mocked(detectPrfSupport).mockResolvedValue(state);
      expect(await detectPRFSupport()).toBe(state);
    },
  );

  it('isPRFSupported is false only for known-unsupported', async () => {
    vi.mocked(detectPrfSupport).mockResolvedValue('unsupported');
    expect(await isPRFSupported()).toBe(false);
    vi.mocked(detectPrfSupport).mockResolvedValue('unknown');
    expect(await isPRFSupported()).toBe(true);
  });

  it('isBiometricAvailable is false in an Android WebView environment', async () => {
    vi.mocked(isPrfViableOnThisClient).mockResolvedValue({
      viable: false,
      reason: 'Android WebView',
      environment: 'webview',
    });
    expect(await isBiometricAvailable()).toBe(false);
  });
});
```

Keep the existing native-app gate test (`isNativeApp() → false`) exactly as it is.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/core/auth/__tests__/webauthn.test.ts`
Expected: FAIL — `webauthn.ts` does not yet delegate to the package.

- [ ] **Step 3: Implement the delegation**

In `src/core/auth/webauthn.ts`:

```ts
import {
  detectPrfSupport,
  isPrfViableOnThisClient,
  isWebAuthnSupported as zktvIsWebAuthnSupported,
  type PrfSupport,
} from 'webauthn-prf-zktv/webauthn';

/** Tri-state PRF capability detection for UI gating (delegates to webauthn-prf-zktv). */
export type PRFSupport = PrfSupport;

export function isWebAuthnSupported(): boolean {
  return zktvIsWebAuthnSupported();
}

export async function detectPRFSupport(): Promise<PRFSupport> {
  return detectPrfSupport();
}

/**
 * False only when PRF is *known* unsupported — 'unknown' clients still attempt
 * enrollment (which hard-verifies PRF) instead of being denied outright.
 */
export async function isPRFSupported(): Promise<boolean> {
  return (await detectPrfSupport()) !== 'unsupported';
}
```

Delete the now-dead inline bodies of `detectPRFSupport`/`isPRFSupported` and the local `PRFSupport` type they replace. In `isBiometricAvailable()`, after the existing `isNativeApp()` and `isWebAuthnSupported()` gates, add the WebView check (do NOT gate on `viable === false` generally — `unknown` clients must still pass, per the existing enrollment hard-verify policy):

```ts
export async function isBiometricAvailable(): Promise<boolean> {
  if (isNativeApp()) {
    return false;
  }
  if (!isWebAuthnSupported()) {
    return false;
  }
  // PRF does not traverse Android WebView → Credential Manager; the package
  // detects that environment even outside Capacitor (which isNativeApp covers).
  const viability = await isPrfViableOnThisClient();
  if (viability.environment === 'webview') {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('Failed to check biometric availability:', error);
    return false;
  }
}
```

- [ ] **Step 4: Run tests, type-check**

Run: `npx vitest run src/core/auth/__tests__/webauthn.test.ts && npm run type-check`
Expected: PASS / 0 errors. `BiometricSetupDialog.tsx` and `LoginPage.tsx` compile unchanged because the export names and shapes are identical.

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/webauthn.ts src/core/auth/__tests__/webauthn.test.ts
git commit -m "refactor: delegate PRF detection to webauthn-prf-zktv"
```

---

### Task 3: `mapZktvError` — package errors → existing user-facing copy

**Files:**
- Create: `src/core/auth/zktvErrors.ts`
- Test: `src/core/auth/__tests__/zktvErrors.test.ts`

**Interfaces:**
- Consumes: package `ZktvError` (has `.code: ZktvErrorCode`).
- Produces: `mapZktvError(error: unknown): Error` — Tasks 4 and 5 wrap every package call site with it.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/auth/__tests__/zktvErrors.test.ts
import { describe, expect, it } from 'vitest';
import {
  CeremonyCancelledError,
  DecryptError,
  PrfResultMissingError,
  PrfUnsupportedError,
  RecordFormatError,
  ReplayError,
} from 'webauthn-prf-zktv';
import { mapZktvError } from '@/core/auth/zktvErrors';

describe('mapZktvError', () => {
  it('maps PRF_UNSUPPORTED to the master-password guidance', () => {
    expect(mapZktvError(new PrfUnsupportedError('x')).message).toBe(
      'This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.',
    );
  });

  it('maps CEREMONY_CANCELLED to the retry guidance', () => {
    expect(mapZktvError(new CeremonyCancelledError('x')).message).toBe(
      'Biometric authentication was cancelled or timed out. Please try again or use your master password.',
    );
  });

  it('maps PRF_RESULT_MISSING to the PRF-missing guidance', () => {
    expect(mapZktvError(new PrfResultMissingError('x')).message).toBe(
      'Authenticator did not return a PRF result. This device does not support PRF; please use your master password.',
    );
  });

  it('maps DECRYPT_FAILED and RECORD_FORMAT to re-enrollment guidance (generic — no wrong-key vs corrupt distinction)', () => {
    const expected =
      'Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.';
    expect(mapZktvError(new DecryptError('x')).message).toBe(expected);
    expect(mapZktvError(new RecordFormatError('x')).message).toBe(expected);
  });

  it('maps REPLAY to a security-check failure', () => {
    expect(mapZktvError(new ReplayError('x')).message).toBe(
      'Biometric authentication failed a security check. Please try again.',
    );
  });

  it('passes non-package errors through unchanged', () => {
    const original = new Error('User not found');
    expect(mapZktvError(original)).toBe(original);
  });

  it('wraps non-Error throwables in a generic message', () => {
    expect(mapZktvError('boom').message).toBe(
      'Biometric authentication failed. Please try again or use your master password.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/auth/__tests__/zktvErrors.test.ts`
Expected: FAIL with "Cannot find module '@/core/auth/zktvErrors'".

- [ ] **Step 3: Implement**

```ts
// src/core/auth/zktvErrors.ts
/**
 * Maps webauthn-prf-zktv typed errors (stable `.code` values) to TrustVault's
 * existing user-facing copy. Keeps UI strings centralized and guarantees no
 * cause chains or key material from the crypto layer reach the UI or logs.
 */
import { ZktvError } from 'webauthn-prf-zktv';

const GENERIC_MESSAGE =
  'Biometric authentication failed. Please try again or use your master password.';

export function mapZktvError(error: unknown): Error {
  if (error instanceof ZktvError) {
    switch (error.code) {
      case 'PRF_UNSUPPORTED':
        return new Error(
          'This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.',
        );
      case 'CEREMONY_CANCELLED':
        return new Error(
          'Biometric authentication was cancelled or timed out. Please try again or use your master password.',
        );
      case 'PRF_RESULT_MISSING':
        return new Error(
          'Authenticator did not return a PRF result. This device does not support PRF; please use your master password.',
        );
      case 'REPLAY':
        return new Error('Biometric authentication failed a security check. Please try again.');
      case 'DECRYPT_FAILED':
      case 'RECORD_FORMAT':
        return new Error(
          'Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.',
        );
      default:
        return new Error(GENERIC_MESSAGE);
    }
  }
  return error instanceof Error ? error : new Error(GENERIC_MESSAGE);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/auth/__tests__/zktvErrors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/zktvErrors.ts src/core/auth/__tests__/zktvErrors.test.ts
git commit -m "feat: map webauthn-prf-zktv error codes to existing user-facing copy"
```

---

### Task 4: Enrollment path — `registerBiometric` via `enrollPrfCredential` + `wrapSecret`

**Files:**
- Modify: `src/data/repositories/UserRepositoryImpl.ts:362-450` (`registerBiometric`)
- Test: `src/data/repositories/__tests__/UserRepositoryImpl.test.ts` (add/replace enrollment tests)

**Interfaces:**
- Consumes: package `enrollPrfCredential({ rpId, rpName, userId, userName, userDisplayName? }) → Promise<{ credentialId: string; prfOutput: Uint8Array; prfSalt: Uint8Array; transports: string[]; publicKey: Uint8Array | null; counter: number; usedSingleCeremony: boolean }>`; `wrapSecret({ prfOutput, prfSalt, secret }) → Promise<WrappedSecretRecord>`; `serializeRecord`, `zeroize`; `mapZktvError` from Task 3.
- Produces: stored Dexie credential rows whose `wrappedVaultKey` is a **serialized v1 record** (versioned JSON envelope) — Task 5's `parseRecord` branch relies on this. `vaultKeyScheme: 'prf-v1'`, `prfSalt` (base64) and `counter` (from the ceremony, not hardcoded 0) keep their columns.

Design note: we intentionally use `enrollPrfCredential` + `wrapSecret` rather than the `enrollVault` composition because the stored credential row needs `publicKey`, which `enrollVault` does not surface. This is the same composition `enrollVault` performs internally.

- [ ] **Step 1: Write the failing tests**

Add to `src/data/repositories/__tests__/UserRepositoryImpl.test.ts` (follow the file's existing user-fixture setup; mock ONLY the ceremony module — core crypto runs real):

```ts
import { vi } from 'vitest';
import { parseRecord, unwrapSecretBytes } from 'webauthn-prf-zktv';
import { enrollPrfCredential } from 'webauthn-prf-zktv/webauthn';
import { PrfUnsupportedError } from 'webauthn-prf-zktv';

vi.mock('webauthn-prf-zktv/webauthn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('webauthn-prf-zktv/webauthn')>()),
  enrollPrfCredential: vi.fn(),
  evaluatePrf: vi.fn(),
}));

// Also mock the app-level availability gates used by registerBiometric:
vi.mock('@/core/auth/webauthn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/auth/webauthn')>()),
  isBiometricAvailable: vi.fn().mockResolvedValue(true),
  isPRFSupported: vi.fn().mockResolvedValue(true),
}));

const FAKE_PRF_OUTPUT = new Uint8Array(32).fill(0xab);
const FAKE_PRF_SALT = new Uint8Array(32).fill(0xcd);

describe('registerBiometric (webauthn-prf-zktv)', () => {
  it('stores a serialized v1 record with the ceremony counter and public key', async () => {
    vi.mocked(enrollPrfCredential).mockResolvedValue({
      credentialId: 'cred-b64url',
      prfOutput: new Uint8Array(FAKE_PRF_OUTPUT), // copy — impl zeroizes it
      prfSalt: new Uint8Array(FAKE_PRF_SALT),
      transports: ['internal'],
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 5,
      usedSingleCeremony: true,
    });

    // createTestUser(): use the file's existing helper that registers a user
    // with a known master password and returns { userId, masterPassword }.
    const { userId, masterPassword } = await createTestUser();
    await repository.registerBiometric(userId, masterPassword, 'Test Device');

    const stored = await db.users.get(userId);
    const cred = stored!.webAuthnCredentials.find((c) => c.id === 'cred-b64url')!;
    expect(cred.vaultKeyScheme).toBe('prf-v1');
    expect(cred.counter).toBe(5);
    expect(cred.publicKey).not.toBe('');

    // The stored value is a package v1 record that unwraps under the PRF output
    // to the SAME raw vault key the master password recovers.
    const record = parseRecord(cred.wrappedVaultKey!);
    const unwrapped = await unwrapSecretBytes({ record, prfOutput: FAKE_PRF_OUTPUT });
    expect(unwrapped.length).toBe(32);
  });

  it('surfaces PRF_UNSUPPORTED as the existing master-password guidance', async () => {
    vi.mocked(enrollPrfCredential).mockRejectedValue(new PrfUnsupportedError('no prf'));
    const { userId, masterPassword } = await createTestUser();
    await expect(repository.registerBiometric(userId, masterPassword)).rejects.toThrow(
      'This browser or device does not support the secure PRF extension required for biometric unlock. Please continue using your master password.',
    );
  });

  it('still rejects a wrong master password before any ceremony', async () => {
    const { userId } = await createTestUser();
    await expect(repository.registerBiometric(userId, 'wrong-password')).rejects.toThrow(
      'Incorrect master password',
    );
    expect(enrollPrfCredential).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/repositories/__tests__/UserRepositoryImpl.test.ts`
Expected: new tests FAIL (implementation still uses `registerCredentialWithPRF`/`wrapVaultKeyWithPRF`; stored value is legacy JSON that `parseRecord` rejects).

- [ ] **Step 3: Implement**

In `UserRepositoryImpl.registerBiometric`, keep everything through the `isPRFSupported()` check and the `rpId` computation unchanged. Replace the block from `const registration = await registerCredentialWithPRF({...})` down to the `newCredential` construction with:

```ts
const { enrollPrfCredential } = await import('webauthn-prf-zktv/webauthn');
const { wrapSecret, serializeRecord, zeroize } = await import('webauthn-prf-zktv');
const { mapZktvError } = await import('@/core/auth/zktvErrors');

let enrollment: Awaited<ReturnType<typeof enrollPrfCredential>>;
try {
  enrollment = await enrollPrfCredential({
    rpId,
    rpName: 'TrustVault',
    userId: user.id,
    userName: user.username ?? user.id,
    userDisplayName: user.displayName ?? user.username ?? user.id,
  });
} catch (error) {
  throw mapZktvError(error);
}

// Recover the raw vault key bytes from storage using the master password
// (unchanged S7 posture: the session key stays non-extractable).
const userSalt = Uint8Array.from(atob(user.salt), c => c.charCodeAt(0));
const tempKey = user.vaultKdf === 'scrypt-v1'
  ? await deriveVaultWrapKey(masterPassword, userSalt)
  : await deriveKeyFromPassword(masterPassword, userSalt);
const vaultKeyBase64 = await decrypt(
  JSON.parse(user.encryptedVaultKey) as Parameters<typeof decrypt>[0],
  tempKey,
);
const vaultKeyRaw = Uint8Array.from(atob(vaultKeyBase64), c => c.charCodeAt(0));

let wrappedVaultKey: string;
try {
  const record = await wrapSecret({
    prfOutput: enrollment.prfOutput,
    prfSalt: enrollment.prfSalt,
    secret: vaultKeyRaw,
  });
  wrappedVaultKey = serializeRecord(record);
} catch (error) {
  throw mapZktvError(error);
} finally {
  vaultKeyRaw.fill(0);
  zeroize(enrollment.prfOutput);
}

const newCredential = {
  id: enrollment.credentialId,
  publicKey: enrollment.publicKey
    ? encodeUint8ArrayToBase64(enrollment.publicKey)
    : '',
  counter: enrollment.counter,
  transports: enrollment.transports as AuthenticatorTransport[],
  createdAt: new Date(),
  deviceName: deviceName ?? 'Biometric Device',
  vaultKeyScheme: 'prf-v1' as const,
  wrappedVaultKey,
  prfSalt: encodeUint8ArrayToBase64(enrollment.prfSalt),
};
```

Delete the now-unused imports of `registerCredentialWithPRF`, `getPRFOutput`, `generatePrfSalt`, and `wrapVaultKeyWithPRF` from this method (the enrollment no longer needs a separate `getPRFOutput` ceremony — `enrollPrfCredential` is adaptive and returns the PRF output itself, single-prompt on Chrome 147+). The credential update/`db.users.update` block below stays unchanged.

- [ ] **Step 4: Run tests, type-check, lint**

Run: `npx vitest run src/data/repositories/__tests__/UserRepositoryImpl.test.ts && npm run type-check`
Expected: PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/UserRepositoryImpl.ts src/data/repositories/__tests__/UserRepositoryImpl.test.ts
git commit -m "refactor: biometric enrollment via webauthn-prf-zktv adaptive ceremony"
```

---

### Task 5: Unlock path + lazy legacy migration — `authenticateWithBiometric`

**Files:**
- Modify: `src/data/repositories/UserRepositoryImpl.ts:238-290` (`authenticateWithBiometric`)
- Test: `src/data/repositories/__tests__/UserRepositoryImpl.test.ts` (add unlock/migration tests)

**Interfaces:**
- Consumes: `evaluatePrf({ credentialId, salt, rpId, storedCounter }) → Promise<{ prfOutput: Uint8Array; counter: number }>` (mocked in tests); `parseRecord`, `serializeRecord`, `unwrapSecret`, `fromTrustVaultRecord`, `zeroize`, `deriveWrapKeyFromPrf`, `TRUSTVAULT_HKDF_INFO` (core, real); Task 4's stored record format; `mapZktvError`.
- Produces: unlock returns the same `AuthSession` shape as today (`vaultKey` non-extractable `CryptoKey`); legacy `wrappedVaultKey` values are overwritten with serialized v1 records after the first successful unlock.

Design note: both formats share ONE `evaluatePrf` ceremony seam (the same composition `unlockVault` performs internally); we call `unwrapSecret` directly so the legacy branch reuses the identical PRF output without a second prompt.

- [ ] **Step 1: Write the failing tests**

Add to `UserRepositoryImpl.test.ts` (same mock setup as Task 4; `evaluatePrf` is already mocked there). The legacy fixture is built with real crypto using the package's exported legacy HKDF label — do NOT import from `biometricVaultKey.ts` (deleted in Task 6):

```ts
import { deriveWrapKeyFromPrf, TRUSTVAULT_HKDF_INFO } from 'webauthn-prf-zktv';
import { evaluatePrf } from 'webauthn-prf-zktv/webauthn';
import { encrypt } from '@/core/crypto/encryption';
import { encodeUint8ArrayToBase64 } from '@/core/utils/base64';

/** Builds a legacy-format wrappedVaultKey exactly as pre-refactor TrustVault did. */
async function buildLegacyWrappedVaultKey(
  vaultKeyRaw: Uint8Array,
  prfOutput: Uint8Array,
): Promise<string> {
  const legacyWrapKey = await deriveWrapKeyFromPrf(prfOutput, TRUSTVAULT_HKDF_INFO);
  const encrypted = await encrypt(encodeUint8ArrayToBase64(vaultKeyRaw), legacyWrapKey);
  return JSON.stringify(encrypted);
}

describe('authenticateWithBiometric (webauthn-prf-zktv)', () => {
  it('unlocks a new-format record and persists the ceremony counter', async () => {
    // enrollBiometricForTest(): register a user, then run Task 4's mocked
    // registerBiometric flow so the stored record is package-format.
    const { userId, credentialId } = await enrollBiometricForTest();
    vi.mocked(evaluatePrf).mockResolvedValue({
      prfOutput: new Uint8Array(FAKE_PRF_OUTPUT),
      counter: 6,
    });

    const session = await repository.authenticateWithBiometric(userId, credentialId);
    expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    expect(session.vaultKey.extractable).toBe(false);

    const stored = await db.users.get(userId);
    const cred = stored!.webAuthnCredentials.find((c) => c.id === credentialId)!;
    expect(cred.counter).toBe(6);
  });

  it('migrates a legacy record on unlock: same prompt, record replaced, unlock succeeds', async () => {
    const { userId, credentialId, vaultKeyRaw } = await createUserWithLegacyBiometric(
      buildLegacyWrappedVaultKey, FAKE_PRF_OUTPUT, FAKE_PRF_SALT,
    );
    vi.mocked(evaluatePrf).mockResolvedValue({
      prfOutput: new Uint8Array(FAKE_PRF_OUTPUT),
      counter: 3,
    });

    const session = await repository.authenticateWithBiometric(userId, credentialId);
    expect(session.vaultKey).toBeInstanceOf(CryptoKey);
    expect(evaluatePrf).toHaveBeenCalledTimes(1); // one ceremony, not two

    const stored = await db.users.get(userId);
    const cred = stored!.webAuthnCredentials.find((c) => c.id === credentialId)!;
    // The legacy JSON has been replaced by a parseable v1 record...
    const record = parseRecord(cred.wrappedVaultKey!);
    // ...that unwraps to the ORIGINAL vault key.
    const bytes = await unwrapSecretBytes({ record, prfOutput: FAKE_PRF_OUTPUT });
    expect(Array.from(bytes)).toEqual(Array.from(vaultKeyRaw));
  });

  it('second unlock after migration takes the new-format path (no fromTrustVaultRecord)', async () => {
    const { userId, credentialId } = await createUserWithLegacyBiometric(
      buildLegacyWrappedVaultKey, FAKE_PRF_OUTPUT, FAKE_PRF_SALT,
    );
    vi.mocked(evaluatePrf).mockResolvedValue({
      prfOutput: new Uint8Array(FAKE_PRF_OUTPUT), counter: 3,
    });
    await repository.authenticateWithBiometric(userId, credentialId); // migrates
    vi.mocked(evaluatePrf).mockResolvedValue({
      prfOutput: new Uint8Array(FAKE_PRF_OUTPUT), counter: 4,
    });
    const session = await repository.authenticateWithBiometric(userId, credentialId);
    expect(session.vaultKey).toBeInstanceOf(CryptoKey);
  });

  it('wrong PRF output yields the generic re-enable message (no wrong-key/corrupt distinction)', async () => {
    const { userId, credentialId } = await enrollBiometricForTest();
    vi.mocked(evaluatePrf).mockResolvedValue({
      prfOutput: new Uint8Array(32).fill(0xee), // wrong output
      counter: 6,
    });
    await expect(repository.authenticateWithBiometric(userId, credentialId)).rejects.toThrow(
      'Biometric needs to be re-enabled on this device. Please sign in with your master password and re-enable biometric in Settings.',
    );
  });
});
```

(`enrollBiometricForTest` and `createUserWithLegacyBiometric` are small helpers to add in the same test file: the first calls `createTestUser()` + the mocked `registerBiometric`; the second calls `createTestUser()`, recovers `vaultKeyRaw` the same way `registerBiometric` does, builds the legacy JSON with `buildLegacyWrappedVaultKey`, and writes a credential row `{ id, publicKey: '', counter: 2, vaultKeyScheme: 'prf-v1', wrappedVaultKey, prfSalt: encodeUint8ArrayToBase64(FAKE_PRF_SALT), createdAt: new Date() }` directly via `db.users.update`. Both return `{ userId, credentialId, vaultKeyRaw }`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/repositories/__tests__/UserRepositoryImpl.test.ts`
Expected: new tests FAIL (implementation still imports `getPRFOutput`/`unwrapVaultKeyWithPRF`; legacy records are unlocked but never migrated; new-format records fail to unlock).

- [ ] **Step 3: Implement**

Replace the body of `authenticateWithBiometric` from the lazy imports (line ~242) through the `finally { prfOutput.fill(0) }` block (line ~259) with:

```ts
const { evaluatePrf } = await import('webauthn-prf-zktv/webauthn');
const {
  parseRecord, serializeRecord, unwrapSecret, fromTrustVaultRecord, zeroize,
} = await import('webauthn-prf-zktv');
const { mapZktvError } = await import('@/core/auth/zktvErrors');

// Dual-format read: package v1 records parse; legacy TrustVault EncryptedData
// JSON does not — that failure IS the format detector (no schema bump needed).
let record: ReturnType<typeof parseRecord> | null = null;
try {
  record = parseRecord(credential.wrappedVaultKey);
} catch {
  record = null; // legacy format → migrate below
}

const prfSaltBytes = record ? record.salt : decodeBase64ToUint8Array(credential.prfSalt);

let vaultKey: CryptoKey;
let newCounter: number;
let migratedWrappedVaultKey: string | null = null;
try {
  const { prfOutput, counter } = await evaluatePrf({
    credentialId,
    salt: prfSaltBytes,
    rpId,
    storedCounter: credential.counter,
  });
  newCounter = counter;
  try {
    if (record) {
      vaultKey = await unwrapSecret({ record, prfOutput });
    } else {
      // Lazy migration: same PRF output unlocks the legacy HKDF label; re-wrap
      // into the v1 format so the next unlock takes the fast path.
      const migrated = await fromTrustVaultRecord({
        legacyJson: credential.wrappedVaultKey,
        prfOutput,
        prfSalt: prfSaltBytes,
      });
      vaultKey = await unwrapSecret({ record: migrated, prfOutput });
      migratedWrappedVaultKey = serializeRecord(migrated);
    }
  } finally {
    zeroize(prfOutput); // S7: PRF output is key material
  }
} catch (error) {
  throw mapZktvError(error);
}
```

Then extend the existing credential-update map so a migration also persists the new record:

```ts
const updatedCredentials = user.webAuthnCredentials.map(c =>
  c.id === credentialId
    ? {
        ...c,
        counter: newCounter,
        lastUsedAt: new Date(),
        ...(migratedWrappedVaultKey ? { wrappedVaultKey: migratedWrappedVaultKey } : {}),
      }
    : c
);
```

Everything after (`db.users.update`, `sealLegacyMetadata`, `ensureDefaultProfile`, session return) stays unchanged.

- [ ] **Step 4: Run the full auth test surface, type-check**

Run: `npx vitest run src/data/repositories/__tests__/UserRepositoryImpl.test.ts src/core/auth && npm run type-check`
Expected: PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/UserRepositoryImpl.ts src/data/repositories/__tests__/UserRepositoryImpl.test.ts
git commit -m "refactor: biometric unlock via webauthn-prf-zktv with lazy legacy migration"
```

---

### Task 6: Cleanup — delete dead inline code, drop SimpleWebAuthn, refresh docs

**Files:**
- Delete: `src/core/auth/biometricVaultKey.ts`, `src/core/auth/__tests__/biometricVaultKey.test.ts`, `src/core/auth/__tests__/webauthnPrf.test.ts`, `src/core/auth/__tests__/webauthn-security.test.ts`, `src/core/auth/__tests__/zktvPackage.test.ts` (Task 1 smoke test — superseded by real usage tests)
- Modify: `src/core/auth/webauthn.ts` (delete dead functions), `package.json` (remove `@simplewebauthn/*`), `src/test/integration.test.ts` (update PRF-function references), `CLAUDE.md`, `SECURITY.md`, `PHASE_4.1_BIOMETRIC_AUTH.md`, `TEST_STATUS.md`

**Interfaces:**
- Consumes: Tasks 2–5 complete (nothing imports the deleted symbols outside tests).
- Produces: final public surface of `src/core/auth/webauthn.ts`: `isWebAuthnSupported`, `isBiometricAvailable`, `detectPRFSupport`, `isPRFSupported`, `getAuthenticatorInfo`, `getDeviceName`, `type PRFSupport`, `type BiometricCredential`.

- [ ] **Step 1: Verify nothing still imports the doomed symbols**

Run:
```bash
grep -rn "registerCredentialWithPRF\|getPRFOutput\|wrapVaultKeyWithPRF\|unwrapVaultKeyWithPRF\|generatePrfSalt\|deriveWrapKeyFromPRF\|registerBiometric,\|authenticateBiometric\|verifyRegistrationResponse\|verifyAuthenticationResponse\|@simplewebauthn" src --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v 'core/auth/webauthn.ts' | grep -v 'core/auth/biometricVaultKey.ts'
```
Expected: no output (note: `UserRepositoryImpl.registerBiometric` the *method* remains — only the webauthn.ts *function* of the same name dies; check import lines, not method definitions). If anything shows up, fix that call site first.

- [ ] **Step 2: Delete files and dead code**

```bash
git rm src/core/auth/biometricVaultKey.ts \
       src/core/auth/__tests__/biometricVaultKey.test.ts \
       src/core/auth/__tests__/webauthnPrf.test.ts \
       src/core/auth/__tests__/webauthn-security.test.ts \
       src/core/auth/__tests__/zktvPackage.test.ts
```

In `src/core/auth/webauthn.ts` delete: `registerBiometric`, `authenticateBiometric`, `verifyRegistrationResponse`, `verifyAuthenticationResponse`, `registerCredentialWithPRF`, `getPRFOutput`, the `PRFExtensionInputs`/`PRFExtensionOutputs`/`PRFRegistrationResult`/`PRFAuthResult`/`RegistrationOptions` types, and all `@simplewebauthn/*` imports. Update `src/test/integration.test.ts` to drop assertions against deleted functions (the repo-layer tests from Tasks 4–5 cover the flows).

- [ ] **Step 3: Remove the dependencies**

```bash
npm uninstall @simplewebauthn/browser @simplewebauthn/types
```

- [ ] **Step 4: Full verification**

Run: `npm run type-check && npm run lint && npx vitest run src/core/auth src/data/repositories src/test/integration.test.ts`
Expected: 0 type errors; no lint regressions on touched files; all tests pass.

- [ ] **Step 5: Refresh docs**

- `SECURITY.md` (Biometric section): note the PRF ceremony + wrapping now come from `webauthn-prf-zktv` (same engine, extracted); HKDF label for new records is `'webauthn-prf-zktv vault key wrap v1'`; legacy records lazily migrated on unlock via `fromTrustVaultRecord`.
- `CLAUDE.md` (Security Notes → Biometric bullet + Last Updated line): same summary, one paragraph.
- `PHASE_4.1_BIOMETRIC_AUTH.md`: mark inline implementation superseded by the package, link the spec.
- `TEST_STATUS.md`: add manual-verification entries — fresh enrollment (expect single prompt on Chrome 147+), unlock, legacy-user unlock (record migrates), passkey deleted → master-password fallback.

- [ ] **Step 6: Commit and update the graph**

```bash
git add -A
git commit -m "refactor: remove inline PRF crypto superseded by webauthn-prf-zktv, drop simplewebauthn"
graphify update .
```

---

## Post-plan verification (manual, before merge to main)

1. `npm run dev` on `localhost` (WebAuthn works on localhost): enroll biometric on a PRF-capable device/browser → expect ONE biometric prompt on Chrome 147+ (`usedSingleCeremony`), two elsewhere.
2. Lock → biometric unlock → vault opens; DevTools → IndexedDB → confirm `wrappedVaultKey` is a `{"v":1,...}` envelope.
3. With a pre-refactor user (or the legacy fixture written via console): biometric unlock once → confirm the stored value flipped to the v1 envelope, second unlock works.
4. Cancel the biometric prompt → confirm the "cancelled or timed out" message and that master-password unlock still works.
5. `npm run build` succeeds; `npm run lighthouse` still >90.
