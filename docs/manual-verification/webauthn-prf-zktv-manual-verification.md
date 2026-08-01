# Manual Verification: webauthn-prf-zktv Refactor

**Date**: 2026-08-01
**Refactor Plan**: `docs/superpowers/plans/2026-07-06-webauthn-prf-zktv-refactor.md`
**Branch**: `main` (commit `6c72702`)
**Automated Suite**: 1403/1403 passing (100%)

---

## Prerequisites

1. **Browser**: Chrome 147+ (for `usedSingleCeremony` PRF optimization) or any browser supporting WebAuthn PRF.
2. **Device**: A device with a biometric authenticator (Face ID, Touch ID, Windows Hello, Android BiometricPrompt).
3. **Environment**: `npm run dev` running on `localhost:3000`.
4. **DevTools**: Open before starting — you'll need to inspect IndexedDB and the network tab.

---

## Verification 1: Fresh Biometric Enrollment

**Goal**: Enroll a new user with biometric on localhost; confirm single-prompt enrollment on PRF-capable devices.

### Steps

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000` in your browser.

3. Register a new account:
   - Enter a username, email, and master password.
   - On the biometric enrollment screen, click "Enable Biometric".

4. **Check 1a — PRF Detection**:
   - Before the biometric prompt appears, verify the UI shows PRF support is detected.
   - In the console, you should see `PRF supported: true` (or similar detection log).

5. **Check 1b — Enrollment Prompt**:
   - **Chrome 147+**: You should see **ONE** biometric prompt (PRF detection + credential registration combined via `usedSingleCeremony`).
   - **Other browsers**: You may see **TWO** prompts (PRF detection check, then registration).
   - Accept the biometric prompt.

6. **Check 1c — Enrollment Success**:
   - After acceptance, the UI should show "Biometric enabled" / "Biometric authentication available".
   - Navigate to DevTools → Application → IndexedDB → `trustvault-db` → `users`.
   - Find your user record. Inspect `webAuthnCredentials`:
     - `vaultKeyScheme` must be `"prf-v1"`
     - `wrappedVaultKey` must be a non-empty string
     - `prfSalt` must be a non-empty base64 string
     - `counter` must be a number > 0
     - `deviceName` should be "Biometric Device" (or your custom name)

7. **Check 1d — IndexedDB Envelope Format**:
   - Inspect `wrappedVaultKey` — it should be a JSON string parseable as `{"v":1,...}` (the v1 envelope format from `webauthn-prf-zktv`).
   - Run in console:
     ```js
     const db = await indexedDB.open('trustvault-db');
     const user = await db.transaction('users').store.getAll().then(arr => arr[0]);
     JSON.parse(user.webAuthnCredentials[0].wrappedVaultKey);
     ```
   - Expected: `{ "v": 1, "salt": "...", "data": "..." }` (or similar v1 structure).

### Pass Criteria
- [ ] Biometric prompt appears and completes successfully
- [ ] `vaultKeyScheme === "prf-v1"` in stored credential
- [ ] `wrappedVaultKey` is a valid v1 envelope JSON string
- [ ] `prfSalt` is present and non-empty
- [ ] Single prompt on Chrome 147+ (two prompts acceptable on other browsers)

---

## Verification 2: Lock → Biometric Unlock → Vault Opens

**Goal**: Lock the vault, unlock with biometric, confirm the vault opens and the stored record is the v1 envelope.

### Steps

1. After enrollment (Verification 1), you are logged in with biometric enabled.

2. **Lock the vault**:
   - Use the lock button in the UI, or wait for the auto-lock timeout (check Settings → Session Timeout).
   - The UI should show a "Vault Locked" screen with a "Use Biometric" button.

3. **Unlock with biometric**:
   - Click "Use Biometric" / "Sign in with biometrics".
   - Accept the biometric prompt.

4. **Check 2a — Vault Opens**:
   - The vault dashboard should load with your credentials visible.
   - No error messages should appear.

5. **Check 2b — IndexedDB Unchanged**:
   - In DevTools → IndexedDB, confirm `wrappedVaultKey` is still the same v1 envelope (no re-write needed on unlock).
   - The `counter` should have incremented by 1 from enrollment.
   - `lastUsedAt` should be set to the current time.

6. **Check 2c — Network Tab**:
   - No network requests should be made during biometric unlock (fully offline).
   - Verify zero egress in the Network tab.

### Pass Criteria
- [ ] Vault unlocks successfully with biometric
- [ ] Dashboard loads with credentials visible
- [ ] `wrappedVaultKey` remains the v1 envelope (no format change)
- [ ] `counter` incremented, `lastUsedAt` updated
- [ ] Zero network egress during unlock

---

## Verification 3: Legacy Record Migration

**Goal**: Simulate a pre-refactor user (legacy credential format) and verify lazy migration on first biometric unlock.

### Steps

1. **Create a legacy fixture** via DevTools console:
   ```js
   // Open DevTools console, run this to create a legacy-format credential
   const db = await indexedDB.open('trustvault-db');
   const tx = db.transaction('users', 'readwrite');
   const users = await tx.store.getAll();
   const user = users[0]; // Your test user

   // Replace the credential with a legacy-format one
   const legacyCred = {
     ...user.webAuthnCredentials[0],
     vaultKeyScheme: 'legacy-device-key', // Old scheme
     wrappedVaultKey: JSON.stringify({
       // Simulated legacy format: old HKDF-based EncryptedData JSON
       version: 1,
       ciphertext: 'dGVzdA==',
       iv: 'dGVzdGl2',
       tag: 'dGVzdHRhZw==',
       label: 'trustvault-vault-key'
     }),
     prfSalt: '' // Empty — legacy credentials had no PRF salt
   };
   user.webAuthnCredentials = [legacyCred];
   await tx.store.put(user);
   console.log('Legacy credential written. Reloading...');
   location.reload();
   ```

2. **Log in with master password**:
   - Enter your username and master password.
   - The vault should open (master password path is unchanged).
   - Check console for a "Stripped legacy credential" log (from `stripLegacyBiometric` in `authenticateWithPassword`).
   - If the legacy credential was stripped, re-enroll biometric (go to Verification 1 steps).
   - If it wasn't stripped (idempotent), proceed to step 3.

3. **If legacy credential still exists** (or create a second credential manually):
   - Lock the vault.
   - Unlock with biometric.

4. **Check 3a — Migration Happens**:
   - The vault should unlock successfully.
   - In DevTools → IndexedDB, inspect the credential:
     - `vaultKeyScheme` should now be `"prf-v1"`
     - `wrappedVaultKey` should now be a v1 envelope JSON string
     - `prfSalt` should now be populated

5. **Check 3b — Second Unlock Works**:
   - Lock and unlock again with biometric.
   - This should take the fast path (no migration needed).
   - `wrappedVaultKey` should remain the v1 envelope.

### Pass Criteria
- [ ] Legacy credential detected on first biometric unlock
- [ ] `wrappedVaultKey` migrated from legacy JSON to v1 envelope
- [ ] `vaultKeyScheme` updated to `"prf-v1"`
- [ ] `prfSalt` populated after migration
- [ ] Second unlock works without migration (fast path)

---

## Verification 4: Cancel Biometric → Master Password Fallback

**Goal**: Cancel the biometric prompt and confirm the app falls back to master password gracefully.

### Steps

1. Lock the vault.

2. Click "Use Biometric" / "Sign in with biometrics".

3. **Cancel the prompt**:
   - Click "Cancel" on the biometric dialog, or wait for the timeout.
   - On macOS: press Escape or click "Cancel".
   - On Windows: click "Sign-in options" → "Password".

4. **Check 4a — Error Message**:
   - The UI should show: "Biometric authentication was cancelled or timed out. Please try again or use your master password."
   - No crash, no unhandled exception in the console.

5. **Check 4b — Master Password Fallback**:
   - The master password login form should be visible.
   - Enter your master password and confirm login succeeds.
   - The vault should open normally.

6. **Check 4c — Rate Limiter**:
   - Cancel the biometric prompt 3+ times in succession.
   - After enough cancellations, the UI should show a temporary lockout message.
   - Wait for the lockout to expire, then try again — it should work.

### Pass Criteria
- [ ] Cancelled prompt shows appropriate error message
- [ ] No console errors or crashes
- [ ] Master password fallback form is accessible
- [ ] Master password login succeeds after cancellation
- [ ] Rate limiter engages after repeated cancellations

---

## Verification 5: Build + Lighthouse

**Goal**: Confirm the production build succeeds and PWA score remains >90.

### Steps

1. **Type Check**:
   ```bash
   npm run type-check
   ```
   Expected: 0 errors.

2. **Lint**:
   ```bash
   npm run lint
   ```
   Expected: No new errors on touched files (pre-existing debt is acceptable).

3. **Build**:
   ```bash
   npm run build
   ```
   Expected: Clean build with no errors.

4. **Preview + Lighthouse**:
   ```bash
   npm run preview
   # In another terminal:
   npm run lighthouse
   ```
   Expected: Lighthouse score >90 across all categories.

5. **Bundle Analysis** (optional but recommended):
   - Check that `webauthn-prf-zktv` is in the `security-vendor` chunk (code-split).
   - Verify no inline PRF ceremony code remains in the bundle.
   - Confirm `biometricVaultKey.ts` is not referenced anywhere (it was deleted).

### Pass Criteria
- [ ] `npm run type-check`: 0 errors
- [ ] `npm run build`: succeeds
- [ ] Lighthouse score >90
- [ ] `webauthn-prf-zktv` is code-split into `security-vendor` chunk
- [ ] No references to deleted `biometricVaultKey.ts`

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `src/core/auth/webauthn.ts` | PRF detection, biometric availability, device info |
| `src/core/auth/zktvErrors.ts` | Error code → user message mapping |
| `src/core/auth/biometricMigration.ts` | `isPrfCredential()`, `stripLegacyBiometric()` |
| `src/data/repositories/UserRepositoryImpl.ts` | Enrollment (`registerBiometric`), unlock (`authenticateWithBiometric`), migration |
| `src/core/auth/__tests__/webauthn.test.ts` | Unit tests for webauthn module |
| `src/core/auth/__tests__/zktvErrors.test.ts` | Unit tests for error mapping |
| `src/data/repositories/__tests__/UserRepositoryImpl.test.ts` | Integration tests for enrollment/unlock/migration |

---

## Known Limitations

- **Android on-device AI**: LiteRT-LM vs Adreno failures are unrelated to this refactor. Pending real hardware testing.
- **Chrome 147+ single-prompt**: Only available on Chrome 147+. Other browsers will show two prompts (PRF check + registration). This is expected behavior.
- **localhost WebAuthn**: WebAuthn works on `localhost` and `127.0.0.1` — no HTTPS required for development.

---

## Sign-Off

| Check | Status | Date | Verified By |
|-------|--------|------|-------------|
| 1. Fresh enrollment | [ ] | | |
| 2. Lock → unlock | [ ] | | |
| 3. Legacy migration | [ ] | | |
| 4. Cancel → fallback | [ ] | | |
| 5. Build + lighthouse | [ ] | | |
