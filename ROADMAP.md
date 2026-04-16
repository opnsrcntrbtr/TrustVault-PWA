# TrustVault PWA - Development Roadmap

**Last Updated:** 2025-10-22
**Current Status:** Alpha (60% complete) - Foundation in place, critical bugs exist
**Target:** Production-ready PWA with feature parity to Android app

---

## 🎯 Overview

This roadmap provides a structured, phased approach to incrementally develop TrustVault PWA from its current alpha state to a production-ready password manager with OWASP security compliance.

### Current Implementation Status

✅ **Complete (100%)**
- Clean Architecture (Domain/Data/Presentation/Core)
- Scrypt password hashing (N=32768, r=8, p=1)
- AES-256-GCM field encryption
- PBKDF2 key derivation (600k iterations)
- IndexedDB with Dexie
- Basic authentication (signin/signup)
- Zustand state management
- PWA infrastructure (service worker, manifest)
- TypeScript strict mode compliance

🟡 **Partial (20-70%)**
- Credential CRUD operations (backend 90%, UI 10%)
- Dashboard UI (skeleton only)
- Biometric authentication (stub)
- Auto-lock mechanism (configured, not wired)
- Import/Export (backend ready, no encryption)

❌ **Missing (0%)**
- Add/Edit credential forms
- Password generator UI
- Search and filtering
- TOTP/2FA generator
- Secure clipboard management
- Settings page
- Credential categories UI
- Password strength analyzer UI
- Comprehensive testing

🐛 **Critical Bugs (Must Fix First)**
1. Vault key not decrypted after authentication
2. Credential passwords returned encrypted instead of decrypted

---

## 🔐 2025 Q4 Enhancement Pillars
| Pillar | Description | High-Value Outcomes | Verification Gates | Owners |
| --- | --- | --- | --- | --- |
| **Vault Trust Hardening** | Close crypto/session defects, deliver auto-lock, and guarantee decrypted data never persists beyond active sessions. | Vault key decrypt fix, secure credential reads, `useAutoLock`, tab-visibility lock, lock/unlock UX copy. | `auth-flow.test.tsx`, manual lock drills recorded in `TEST_STATUS.md`, IndexedDB inspection screenshots. | Security Architect + QA lead |
| **CredOps Experience** | Complete credential CRUD UX, password generator, TOTP, clipboard controls, OCR camera scan, and responsive dashboard/search so users can actually operate the vault. | Add/Edit forms, generator dialog, `clipboardManager`, TOTP widget, dashboard filters, mobile gestures, **OCR credential capture via camera**. | `credential-crud.test.tsx`, `ocr-capture.test.ts`, Lighthouse Accessibility ≥ 90, UX review artifacts linked in `KEY_FINDINGS.md`. | UX Director + Front-end lead |
| **Passwordless & Recovery** | Provide biometric unlock, master password rotation, encrypted import/export, and recovery comms. | WebAuthn enrollment/signin, change-master-password wizard with progress, `.tvault` export/import with merge/replace, recovery guide updates. | `import-export.test.tsx`, WebAuthn mock tests, manual recovery drill logged in `TEST_STATUS.md`. | Security Architect + Release Captain |
| **Threat Intelligence & Reporting** | Ship breach telemetry, automate OWASP audits, and enforce test coverage so trust claims stay evidence-backed. | HIBP integration, Security Audit dashboard, SECURITY_AUDIT_REPORT refresh, >85% Vitest coverage, security CI pipeline. | `npm run test:coverage`, `npm run lighthouse:security`, updated `SECURITY_AUDIT_REPORT.md`. | QA lead + Security Architect |

> **Guideline:** No feature is “done” until the relevant gate in the table is met **and** documentation (README, AGENTS, CLAUDE, copilot instructions) reflects the change. Use the pillars to tag every roadmap item, PR, and test suite.

---

## 📋 Phase Structure

Each phase includes:
- **Goal**: What we're building
- **Success Criteria**: How we know it's done
- **Estimated Time**: Developer hours
- **Dependencies**: What must be complete first
- **Prompt**: Exact instruction to give Claude Code
- **Verification**: Testing checklist

---

## 🔝 High-Value Use Case Focus (Nov 24, 2025)

To accelerate toward production readiness, the next roadmap cycles will prioritize five cross-cutting use cases. Each bundle ties business value to concrete code areas and validation requirements.

| # | Use Case & User Story | Rationale | Key Components | Validation Plan |
|---|-----------------------|-----------|----------------|-----------------|
| 1 | **Master Password Session Lifecycle** — “As a vault owner I can sign in, auto-lock on inactivity/tab hide, and unlock without losing decrypted data.” | Core trust guarantee; regressions previously noted in `KEY_FINDINGS.md`. | `UserRepositoryImpl.authenticateWithPassword`, `useAuthStore`, `useAutoLock.ts`, `UnlockPage`, clipboard clearing helpers. | Extend `src/__tests__/integration/auth-flow.test.tsx` to cover lock/unlock, add hook tests for `useAutoLock` with fake timers, ensure vault keys and decrypted data purge on lock failures. |
| 2 | **Secure Credential Lifecycle (Cards, TOTP, Autofill)** — “I can add/update/delete login, payment, and TOTP-enabled credentials and opt into browser autofill.” | Differentiates enterprise UX; ensures encryption paths match UI expectations. | `AddCredentialPage.tsx`, `EditCredentialPage.tsx`, `CredentialRepositoryImpl`, `core/autofill/credentialManagementService.ts`, `core/auth/totp.ts`, `TotpDisplay`. | Expand `credential-crud.test.tsx` to cover category branches, add repository unit tests for card/TOTP encryption, mock Credential Management API, and run UI smoke tests for autofill opt-in. |
| 3 | **Biometric Enrollment & Passwordless Unlock** — “After enabling biometrics I can unlock with Face ID/Fingerprint via WebAuthn-backed vault keys.” | Matches Android feature parity (see `PHASE_4.1_BIOMETRIC_AUTH.md`) and reduces signin friction. | `UserRepositoryImpl.registerBiometric`/`authenticateWithBiometric`, `core/auth/webauthn.ts`, `core/auth/biometricVaultKey.ts`, `SettingsPage`, `SigninPage`, `UnlockPage`. | Add mocked WebAuthn unit tests (counter, challenge, vault-key wrapping), plus integration specs that simulate enrollment + unlock fallback states. |
| 4 | **Breach Detection Triage & Security Audit** — “From Dashboard/Security Audit I can scan via HIBP, see alerts, and drill into breach details.” | Converts `BREACH_DETECTION_README.md` into enforced behavior; required for compliance narratives. | `core/breach/hibpService.ts`, `breachResultsRepository.ts`, `SecurityAuditPage.tsx`, `BreachAlertBanner.tsx`, `.env` feature flags. | Write service tests covering k-anonymity, caching, rate limiting; create UI integration test that mocks HIBP responses and asserts banner/modal behavior. |
| 5 | **Encrypted Import/Export & Recovery** — “I can export my vault to a password-protected `.tvault` file and re-import/merge safely.” | Closes high-risk plaintext export gap (`ROADMAP Phase 3.3`) and enables disaster recovery. | `CredentialRepositoryImpl.exportAll/importFromJson`, forthcoming `core/crypto/exportEncryption.ts`, `ExportDialog.tsx`, `ImportDialog.tsx`, `SettingsPage`. | Implement crypto-roundtrip unit tests (correct password, wrong password, duplicate handling) and an integration spec that exports, wipes IndexedDB, and re-imports data. |

> **Call to Action:** Treat these flows as the “north star” for the next roadmap slice. Each Phase below should reference which use case(s) it unblocks, and all code changes must land alongside the outlined tests.

---

## 🚨 PHASE 0: Critical Bug Fixes (URGENT)

**Goal:** Fix blocking bugs preventing credential access
**Time:** 2-3 hours
**Priority:** 🔴 CRITICAL - Must complete before any other work

### Phase 0.1: Fix Vault Key Decryption

**Current Issue:** `UserRepositoryImpl.ts:78-107` - Vault key derived but never decrypted from encrypted storage.

**Prompt for Claude Code:**
```
Fix the vault key decryption bug in UserRepositoryImpl.ts authenticateWithPassword() method.

Current behavior:
- Line 92: Derives a vault key from password+salt
- Line 101-106: Returns this derived key as the session vaultKey
- Problem: The ACTUAL vault key (masterVaultKey) is encrypted in user.encryptedVaultKey but never decrypted

Expected behavior:
1. Derive temporary key from password+salt (for decrypting the vault key)
2. Decrypt user.encryptedVaultKey using the derived key
3. Return the DECRYPTED vault key in the session

Reference:
- Encryption: UserRepositoryImpl.ts:23-38 (createUser method)
- Line 38: masterVaultKey is encrypted with vaultKey
- Line 45: Stored as encryptedVaultKey

Files to modify:
- src/data/repositories/UserRepositoryImpl.ts (lines 78-107)

Test after fix:
1. Create new account at /signup
2. Add a credential with password "test123"
3. Sign out and sign back in
4. Verify credential password displays as "test123" not encrypted gibberish
```

**Success Criteria:**
- [ ] `authenticateWithPassword()` returns decrypted vault key
- [ ] Credentials readable after signin
- [ ] No TypeScript errors
- [ ] Test passes: signup → add credential → signout → signin → read credential

**Files to Modify:**
- `src/data/repositories/UserRepositoryImpl.ts`

---

### Phase 0.2: Fix Credential Password Decryption

**Current Issue:** `CredentialRepositoryImpl.ts:37-49` - Read methods ignore vaultKey parameter, return encrypted data.

**Prompt for Claude Code:**
```
Fix credential decryption in CredentialRepositoryImpl.ts read methods.

Current behavior:
- findById() and findAll() accept vaultKey parameter
- They query IndexedDB but never use vaultKey to decrypt
- Return encrypted password/notes fields

Expected behavior:
1. Query IndexedDB for encrypted credentials
2. Decrypt sensitive fields using vaultKey + decrypt() from encryption.ts
3. Return credential with plaintext password/notes

Sensitive fields to decrypt (if not null):
- password
- notes
- cardNumber (for payment cards)
- cardCVV (for payment cards)

Reference:
- Encryption function: src/core/crypto/encryption.ts (encrypt/decrypt)
- Save operation: CredentialRepositoryImpl.ts:70-119 (shows encryption)
- Encrypted format: { ciphertext, iv, authTag }

Files to modify:
- src/data/repositories/CredentialRepositoryImpl.ts (lines 37-61)

Helper function to add:
```typescript
private async decryptCredential(
  stored: StoredCredential,
  vaultKey: CryptoKey
): Promise<Credential> {
  return {
    ...stored,
    password: stored.password ? await decrypt(JSON.parse(stored.password), vaultKey) : null,
    notes: stored.notes ? await decrypt(JSON.parse(stored.notes), vaultKey) : null,
    // Add cardNumber, cardCVV for payment types
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}
```

Test after fix:
1. Sign in with existing account
2. Add credential with password "MyPassword123"
3. Refresh page
4. Verify credential displays "MyPassword123" not encrypted data
```

**Success Criteria:**
- [ ] `findById()` returns decrypted credentials
- [ ] `findAll()` returns decrypted credentials
- [ ] Password field shows plaintext after page refresh
- [ ] No TypeScript errors

**Files to Modify:**
- `src/data/repositories/CredentialRepositoryImpl.ts`

---

### Phase 0.3: Verify End-to-End Flow

**Prompt for Claude Code:**
```
Test the complete authentication and credential flow after bug fixes.

Manual test checklist:
1. Clear database: window.debugDB.clearAllData()
2. Sign up with email: test@example.com, password: TestPassword123!
3. Navigate to dashboard
4. Add credential: Title="Gmail", Username="user@gmail.com", Password="secret123"
5. Sign out
6. Sign in with same credentials
7. Verify credential displays correctly with password "secret123" visible

If any step fails:
- Check console for errors
- Verify vault key is decrypted (add console.log in authenticateWithPassword)
- Verify credentials are decrypted (add console.log in findAll)
- Check IndexedDB in DevTools > Application > Storage

Run type check:
npm run type-check

Expected: No TypeScript errors
```

**Success Criteria:**
- [ ] Complete signup → add → signout → signin → read flow works
- [ ] Credentials decrypt correctly
- [ ] No console errors
- [ ] TypeScript builds without errors

---

## 🏗️ PHASE 1: Core Credential Management (Foundation)

**Goal:** Complete CRUD operations with full UI
**Time:** 18-22 hours
**Dependencies:** Phase 0 complete

### Phase 1.1: Add Credential Form

**Prompt for Claude Code:**
```
Create the Add Credential form component with Material-UI.

Requirements:
1. Form fields:
   - Title* (required, text)
   - Username (text)
   - Password* (required, text with show/hide toggle)
   - Website URL (text, validates URL format)
   - Notes (multiline text)
   - Category (dropdown: Login, Payment, Identity, Note, Secure Note)
   - Favorite (toggle)

2. Password field features:
   - Show/Hide icon button
   - "Generate" button next to field (stub for now)
   - Strength indicator below field (use analyzePasswordStrength from password.ts)

3. Validation:
   - Title: 1-100 characters
   - Password: minimum 1 character (no max)
   - URL: valid format or empty
   - Show errors below fields

4. Actions:
   - Cancel (navigate back to dashboard)
   - Save (call credentialRepository.save with encrypted fields)

5. Success flow:
   - Show success message
   - Navigate to dashboard after 1 second
   - Clear form

Files to create:
- src/presentation/pages/AddCredentialPage.tsx
- src/presentation/components/PasswordStrengthIndicator.tsx

Files to modify:
- src/presentation/App.tsx (add route /credentials/add)

Reference:
- Signup form: src/presentation/pages/SignupPage.tsx (for form patterns)
- Save logic: src/data/repositories/CredentialRepositoryImpl.ts:70-119
- Password strength: src/core/crypto/password.ts:96-183

Material-UI components to use:
- TextField
- Select/MenuItem (for category)
- Switch (for favorite)
- Button
- Alert (for success/error)
- Card/CardContent (for layout)

Test after implementation:
1. Navigate to /credentials/add
2. Fill form with test data
3. Click Save
4. Verify credential appears in dashboard
5. Verify password saved encrypted in IndexedDB
```

**Success Criteria:**
- [ ] Form renders with all fields
- [ ] Password show/hide toggle works
- [ ] Validation shows errors
- [ ] Save encrypts and stores credential
- [ ] Success message displays
- [ ] Navigates to dashboard after save

**Files to Create:**
- `src/presentation/pages/AddCredentialPage.tsx` (300-400 lines)
- `src/presentation/components/PasswordStrengthIndicator.tsx` (100-150 lines)

**Files to Modify:**
- `src/presentation/App.tsx` (add route)

**Time Estimate:** 6-8 hours

---

### Phase 1.2: Edit Credential Form

**Prompt for Claude Code:**
```
Create the Edit Credential form by adapting AddCredentialPage.

Requirements:
1. Load existing credential by ID from route parameter
2. Pre-fill all form fields
3. Same validation as Add form
4. Update operation instead of create
5. Delete button (with confirmation dialog)

Files to create:
- src/presentation/pages/EditCredentialPage.tsx (or refactor Add/Edit into one)
- src/presentation/components/DeleteConfirmDialog.tsx

Files to modify:
- src/presentation/App.tsx (add route /credentials/:id/edit)

Approach options:
A. Create separate EditCredentialPage.tsx (simpler, more code duplication)
B. Refactor into CredentialFormPage.tsx with add/edit modes (cleaner, more complex)

Recommendation: Option A for speed, refactor later if needed

Delete confirmation dialog:
- Title: "Delete [credential title]?"
- Message: "This action cannot be undone."
- Actions: Cancel, Delete (red color)
- On delete: call repository.delete(), navigate to dashboard

Test after implementation:
1. Click edit icon on credential card
2. Verify all fields pre-filled
3. Modify password field
4. Save and verify changes persist
5. Test delete with confirmation
```

**Success Criteria:**
- [ ] Edit form loads with existing data
- [ ] Updates save correctly
- [ ] Delete confirmation shows
- [ ] Delete removes credential
- [ ] Navigation works

**Files to Create:**
- `src/presentation/pages/EditCredentialPage.tsx` (300-400 lines)
- `src/presentation/components/DeleteConfirmDialog.tsx` (80-100 lines)

**Files to Modify:**
- `src/presentation/App.tsx` (add route)

**Time Estimate:** 4-6 hours

---

### Phase 1.3: Dashboard Enhancement

**Prompt for Claude Code:**
```
Enhance DashboardPage to display credentials in a card grid with actions.

Current state: src/presentation/pages/DashboardPage.tsx has skeleton UI

Requirements:
1. Load all credentials from repository on mount
2. Display in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
3. Each credential card shows:
   - Title (large text)
   - Username (medium text, gray)
   - Website (small text with link icon)
   - Category badge (colored chip)
   - Favorite star (yellow if true)
   - Last updated (relative time, e.g. "2 hours ago")

4. Card actions (hover or click):
   - Copy username (to clipboard)
   - Copy password (to clipboard)
   - Edit (navigate to /credentials/:id/edit)
   - Delete (show confirmation)

5. Clipboard security:
   - Copy password: Auto-clear after 30 seconds
   - Show "Copied!" snackbar notification
   - Use Clipboard API with fallback

6. Empty state:
   - Show when no credentials exist
   - Message: "No credentials yet"
   - Button: "Add your first credential"

7. FAB (Floating Action Button):
   - Position: bottom-right
   - Icon: Add icon
   - Action: Navigate to /credentials/add

Material-UI components:
- Grid (for responsive layout)
- Card, CardContent, CardActions
- IconButton (for actions)
- Chip (for category badge)
- Tooltip (for action hints)
- Snackbar (for copy notifications)
- Fab (for add button)

Helper utilities to create:
- src/presentation/utils/clipboard.ts (secure copy with auto-clear)
- src/presentation/utils/timeFormat.ts (relative time formatting)

Test after implementation:
1. Add 5+ credentials
2. Verify grid layout responsive
3. Test copy username (shows notification)
4. Test copy password (shows notification, clears after 30s)
5. Test edit/delete actions
6. Test empty state with no credentials
```

**Success Criteria:**
- [ ] Credentials display in card grid
- [ ] Copy username/password works
- [ ] Clipboard auto-clears after 30s
- [ ] Edit/delete actions functional
- [ ] Empty state displays correctly
- [ ] Responsive layout works

**Files to Modify:**
- `src/presentation/pages/DashboardPage.tsx` (expand from 328 to 500+ lines)

**Files to Create:**
- `src/presentation/utils/clipboard.ts` (100-150 lines)
- `src/presentation/utils/timeFormat.ts` (50-80 lines)
- `src/presentation/components/CredentialCard.tsx` (200-250 lines)

**Time Estimate:** 6-8 hours

---

### Phase 1.4: Search and Filter

**Prompt for Claude Code:**
```
Add search and filter capabilities to DashboardPage.

Requirements:
1. Search bar at top of dashboard:
   - Real-time search (debounced 300ms)
   - Searches: title, username, website fields
   - Case-insensitive
   - Clear button (X icon)

2. Filter chips below search:
   - Category filter (All, Login, Payment, Identity, Note, Secure Note)
   - Favorites only toggle
   - Active filters highlighted

3. Sort options (dropdown):
   - Title A-Z
   - Title Z-A
   - Recently updated
   - Recently created
   - Favorites first

4. Results display:
   - Show count: "12 credentials" or "2 credentials found"
   - No results message if search returns empty

Implementation approach:
- Add search/filter state to DashboardPage
- Filter credentials array before rendering
- Use useMemo for performance on large lists
- Debounce search input with lodash.debounce or custom hook

Components needed:
- SearchBar component (TextField with clear button)
- FilterChips component (category + favorite chips)
- SortDropdown component (Select with options)

Files to modify:
- src/presentation/pages/DashboardPage.tsx

Files to create:
- src/presentation/components/SearchBar.tsx
- src/presentation/components/FilterChips.tsx
- src/presentation/components/SortDropdown.tsx

Test after implementation:
1. Search for partial title match
2. Filter by category (e.g., "Login")
3. Toggle favorites filter
4. Change sort order
5. Combine search + filter + sort
6. Clear all filters
```

**Success Criteria:**
- [ ] Search filters credentials in real-time
- [ ] Category filter works
- [ ] Favorites filter works
- [ ] Sort changes order
- [ ] Combined filters work correctly
- [ ] No results message displays

**Files to Modify:**
- `src/presentation/pages/DashboardPage.tsx`

**Files to Create:**
- `src/presentation/components/SearchBar.tsx` (80-100 lines)
- `src/presentation/components/FilterChips.tsx` (100-120 lines)
- `src/presentation/components/SortDropdown.tsx` (80-100 lines)

**Time Estimate:** 4-6 hours

---

## 🔐 PHASE 2: Advanced Security Features

**Goal:** Implement security-critical features from Android app
**Time:** 20-25 hours
**Dependencies:** Phase 1 complete

### Phase 2.1: Password Generator

**Prompt for Claude Code:**
```
Implement the password generator UI and integrate with credential forms.

Requirements:
1. Generator dialog/modal:
   - Length slider: 12-32 characters (default 20)
   - Checkboxes: Uppercase, Lowercase, Numbers, Symbols (all checked by default)
   - Exclude ambiguous characters option (0/O, l/I/1)
   - Generated password display (large, monospace font)
   - Strength indicator
   - Copy button
   - Regenerate button
   - Use in form button

2. Integration points:
   - "Generate" button next to password field in Add/Edit forms
   - Opens generator modal
   - "Use" button fills password field and closes modal

3. Generator logic:
   - Use existing generateSecurePassword() from password.ts
   - Enhance with exclude ambiguous option
   - Ensure at least one character from each selected type

4. Storage:
   - Save generator preferences to localStorage
   - Restore preferences on next open

Files to create:
- src/presentation/components/PasswordGeneratorDialog.tsx (300-400 lines)
- src/presentation/hooks/usePasswordGenerator.ts (150-200 lines)

Files to modify:
- src/presentation/pages/AddCredentialPage.tsx (add Generate button)
- src/presentation/pages/EditCredentialPage.tsx (add Generate button)
- src/core/crypto/password.ts (add excludeAmbiguous option)

Material-UI components:
- Dialog
- Slider
- FormControlLabel/Checkbox
- Button
- TextField (readonly for display)
- IconButton (for copy/regenerate)

Test after implementation:
1. Click Generate button in Add Credential form
2. Adjust length slider
3. Toggle character types
4. Click Regenerate multiple times
5. Copy password
6. Use password in form
7. Verify preferences persist after close/reopen
```

**Success Criteria:**
- [ ] Generator dialog opens from forms
- [ ] Options control generation
- [ ] Strength indicator updates
- [ ] Copy and regenerate work
- [ ] Use button fills form field
- [ ] Preferences persist

**Files to Create:**
- `src/presentation/components/PasswordGeneratorDialog.tsx` (300-400 lines)
- `src/presentation/hooks/usePasswordGenerator.ts` (150-200 lines)

**Files to Modify:**
- `src/presentation/pages/AddCredentialPage.tsx`
- `src/presentation/pages/EditCredentialPage.tsx`
- `src/core/crypto/password.ts` (add excludeAmbiguous parameter)

**Time Estimate:** 6-8 hours

---

### Phase 2.2: TOTP/2FA Generator

**Prompt for Claude Code:**
```
Implement TOTP (Time-based One-Time Password) generator for 2FA codes.

Requirements:
1. Add TOTP secret field to Credential entity:
   - Optional field: totpSecret (string, encrypted)
   - QR code scanning not required (manual entry only for PWA)

2. TOTP generator logic:
   - RFC 6238 compliant
   - 6-digit codes (default)
   - 30-second refresh interval
   - Use @noble/hashes for HMAC-SHA1
   - Compatible with Google Authenticator format

3. UI integration:
   - Add "TOTP Secret" field to credential forms (optional)
   - Show TOTP code in credential card if secret exists
   - Live countdown timer (30s circle progress)
   - Copy TOTP code button
   - Format: 000 000 (space in middle for readability)

4. Implementation files:
   - Core logic: src/core/auth/totp.ts
   - Component: src/presentation/components/TotpDisplay.tsx

Algorithm:
```typescript
import { hmac } from '@noble/hashes/hmac';
import { sha1 } from '@noble/hashes/sha1';

export function generateTOTP(secret: string, timeStep: number = 30): string {
  const epoch = Math.floor(Date.now() / 1000 / timeStep);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(epoch), false);

  const secretBytes = base32Decode(secret);
  const hash = hmac(sha1, secretBytes, new Uint8Array(buffer));

  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}
```

Files to create:
- src/core/auth/totp.ts (TOTP generation + base32 decode)
- src/presentation/components/TotpDisplay.tsx (live code + timer)

Files to modify:
- src/domain/entities/Credential.ts (add totpSecret field)
- src/data/repositories/CredentialRepositoryImpl.ts (encrypt/decrypt totpSecret)
- src/presentation/pages/AddCredentialPage.tsx (add TOTP field)
- src/presentation/pages/EditCredentialPage.tsx (add TOTP field)
- src/presentation/components/CredentialCard.tsx (show TOTP if exists)

Test after implementation:
1. Add credential with TOTP secret (use test secret: JBSWY3DPEHPK3PXP)
2. Verify 6-digit code displays
3. Verify code changes every 30 seconds
4. Verify countdown timer animates
5. Copy code and test in 2FA-enabled service
6. Verify TOTP secret encrypted in IndexedDB
```

**Success Criteria:**
- [ ] TOTP codes generate correctly (RFC 6238)
- [ ] Codes refresh every 30 seconds
- [ ] Timer displays countdown
- [ ] Copy button works
- [ ] TOTP secret encrypted in database
- [ ] Compatible with Google Authenticator

**Files to Create:**
- `src/core/auth/totp.ts` (200-250 lines)
- `src/presentation/components/TotpDisplay.tsx` (150-200 lines)

**Files to Modify:**
- `src/domain/entities/Credential.ts`
- `src/data/repositories/CredentialRepositoryImpl.ts`
- `src/presentation/pages/AddCredentialPage.tsx`
- `src/presentation/pages/EditCredentialPage.tsx`
- `src/presentation/components/CredentialCard.tsx`

**Time Estimate:** 6-8 hours

---

### Phase 2.3: Auto-Lock Mechanism

**Prompt for Claude Code:**
```
Implement automatic session locking with configurable timeout.

Current state: User.securitySettings has sessionTimeoutMinutes but not enforced

Requirements:
1. Inactivity detection:
   - Track last user activity (mouse, keyboard, touch)
   - Reset timer on any interaction
   - Global event listeners on document

2. Lock trigger:
   - When timeout reached:
     - Clear vault key from authStore
     - Clear decrypted credentials from credentialStore
     - Navigate to /signin
     - Show "Session locked" message

3. Background/Tab visibility:
   - Lock immediately when tab hidden (document.visibilityState)
   - Optional: reduce timeout when tab in background

4. Settings integration:
   - Add timeout selector to Settings page: 1, 5, 15, 30 minutes, Never
   - Save to user.securitySettings
   - Apply on next signin

Implementation:
- Create useAutoLock hook
- Initialize in App.tsx (top level)
- Store timeout in Zustand authStore
- Clear memory on lock (no credential remnants)

Files to create:
- src/presentation/hooks/useAutoLock.ts (200-250 lines)
- src/presentation/components/AutoLockSettings.tsx (100-150 lines)

Files to modify:
- src/presentation/App.tsx (add useAutoLock hook)
- src/presentation/store/authStore.ts (add lock() method)
- src/presentation/store/credentialStore.ts (add clearAll() method)

Security considerations:
- No credential data in memory after lock
- Vault key must be re-derived on unlock (re-enter password)
- Lock bypasses navigation guards

Test after implementation:
1. Set timeout to 1 minute in settings
2. Sign in and wait 1 minute without interaction
3. Verify automatic redirect to /signin
4. Verify "Session locked" message displays
5. Sign in again and verify credentials reload
6. Test tab switch (should lock immediately if configured)
```

**Success Criteria:**
- [ ] Timeout triggers automatic lock
- [ ] Activity resets timer
- [ ] Tab visibility triggers lock
- [ ] Vault key cleared on lock
- [ ] Settings page controls timeout
- [ ] Re-authentication required after lock

**Files to Create:**
- `src/presentation/hooks/useAutoLock.ts` (200-250 lines)
- `src/presentation/components/AutoLockSettings.tsx` (100-150 lines)

**Files to Modify:**
- `src/presentation/App.tsx`
- `src/presentation/store/authStore.ts` (add lock method)
- `src/presentation/store/credentialStore.ts` (add clearAll method)

**Time Estimate:** 5-7 hours

---

### Phase 2.4: Secure Clipboard Manager

**Prompt for Claude Code:**
```
Enhance clipboard functionality with auto-clear and security flags.

Current state: Basic clipboard utility exists in clipboard.ts (from Phase 1.3)

Requirements:
1. Auto-clear mechanism:
   - Start timer when password/sensitive field copied
   - Clear clipboard after configurable duration (default 30s)
   - Show countdown notification: "Clipboard clears in 25s"
   - Cancel timer if user copies something else

2. Security enhancements:
   - Mark clipboard content as sensitive (if Clipboard API supports)
   - Prevent sync to cloud clipboard (Android 13+ equivalent for PWA)
   - Visual indicator when clipboard contains sensitive data

3. Settings integration:
   - Clipboard timeout: 15s, 30s, 60s, 120s, Never
   - Save to user.securitySettings.clipboardClearSeconds

4. Implementation approach:
   - Enhance existing clipboard.ts utility
   - Add ClipboardManager class with timer
   - Show Snackbar with countdown
   - Integrate with Settings page

Files to modify:
- src/presentation/utils/clipboard.ts (expand to 200-250 lines)

Files to create:
- src/presentation/components/ClipboardNotification.tsx (100-150 lines)
- src/presentation/components/ClipboardSettings.tsx (80-100 lines)

Enhanced clipboard.ts structure:
```typescript
class SecureClipboardManager {
  private clearTimer: NodeJS.Timeout | null = null;
  private onCountdown?: (seconds: number) => void;

  async copy(text: string, isSensitive: boolean, clearAfter?: number): Promise<void> {
    await navigator.clipboard.writeText(text);

    if (isSensitive && clearAfter) {
      this.startClearTimer(clearAfter);
    }
  }

  private startClearTimer(seconds: number): void {
    this.cancelClearTimer();

    let remaining = seconds;
    this.clearTimer = setInterval(() => {
      remaining--;
      this.onCountdown?.(remaining);

      if (remaining <= 0) {
        this.clearClipboard();
      }
    }, 1000);
  }

  private async clearClipboard(): Promise<void> {
    await navigator.clipboard.writeText('');
    this.cancelClearTimer();
  }

  cancelClearTimer(): void {
    if (this.clearTimer) {
      clearInterval(this.clearTimer);
      this.clearTimer = null;
    }
  }
}

export const clipboardManager = new SecureClipboardManager();
```

Test after implementation:
1. Copy password from credential card
2. Verify "Copied! Clearing in 30s" notification shows
3. Wait and observe countdown
4. After 30s, verify clipboard is empty
5. Copy password again, then copy username (non-sensitive)
6. Verify password timer cancelled
7. Test different timeout settings
```

**Success Criteria:**
- [ ] Auto-clear triggers after timeout
- [ ] Countdown notification displays
- [ ] Timer cancels on new copy
- [ ] Settings control timeout duration
- [ ] Empty clipboard after timer expires

**Files to Modify:**
- `src/presentation/utils/clipboard.ts` (expand to 200-250 lines)

**Files to Create:**
- `src/presentation/components/ClipboardNotification.tsx` (100-150 lines)
- `src/presentation/components/ClipboardSettings.tsx` (80-100 lines)

**Time Estimate:** 4-5 hours

---

## ⚙️ PHASE 3: Settings & User Experience

**Goal:** Complete settings page and enhance UX
**Time:** 15-18 hours
**Dependencies:** Phase 2 complete

### Phase 3.1: Settings Page

**Prompt for Claude Code:**
```
Create comprehensive Settings page for user preferences and security.

Requirements:
1. Settings sections:

   **Security Settings**
   - Session timeout (dropdown: 1, 5, 15, 30 min, Never)
   - Clipboard auto-clear timeout (dropdown: 15, 30, 60, 120s, Never)
   - Require password on wake (toggle)
   - Biometric authentication (toggle, if available)

   **Display Settings**
   - Theme (dropdown: Light, Dark, System) [future feature]
   - Show password strength indicators (toggle)
   - Credential card density (dropdown: Comfortable, Compact)

   **Password Generator Defaults**
   - Default length (slider: 12-32)
   - Include uppercase (toggle)
   - Include lowercase (toggle)
   - Include numbers (toggle)
   - Include symbols (toggle)
   - Exclude ambiguous characters (toggle)

   **Data Management**
   - Export vault (button → trigger Phase 3.3)
   - Import vault (button → trigger Phase 3.3)
   - Clear all data (button with double confirmation)

   **Account**
   - Change master password (button → Phase 3.2)
   - Last login: [timestamp]
   - Account created: [timestamp]

2. Layout:
   - Grouped by section with dividers
   - Each setting has label + description
   - Changes save immediately (no Save button)
   - Show saving indicator on update

3. Persistence:
   - Save to user.securitySettings in database
   - Update authStore settings immediately
   - Apply settings without re-login

Files to create:
- src/presentation/pages/SettingsPage.tsx (400-500 lines)
- src/presentation/components/SettingSection.tsx (100-150 lines)
- src/presentation/components/SettingItem.tsx (80-100 lines)

Files to modify:
- src/presentation/App.tsx (add route /settings)
- src/data/repositories/UserRepositoryImpl.ts (use updateSecuritySettings method)

Test after implementation:
1. Navigate to /settings
2. Change session timeout
3. Verify saved to database (check IndexedDB)
4. Change multiple settings
5. Refresh page, verify settings persist
6. Test Clear all data with double confirmation
```

**Success Criteria:**
- [ ] All settings sections render
- [ ] Settings save immediately
- [ ] Changes persist across sessions
- [ ] Clear data confirmation works
- [ ] Last login displays correctly

**Files to Create:**
- `src/presentation/pages/SettingsPage.tsx` (400-500 lines)
- `src/presentation/components/SettingSection.tsx` (100-150 lines)
- `src/presentation/components/SettingItem.tsx` (80-100 lines)

**Files to Modify:**
- `src/presentation/App.tsx` (add route)

**Time Estimate:** 6-8 hours

---

### Phase 3.2: Change Master Password

**Prompt for Claude Code:**
```
Implement master password change functionality with re-encryption.

Current state: UserRepositoryImpl.changeMasterPassword() exists but not wired to UI

Requirements:
1. UI Dialog/Page:
   - Current password (required, verify)
   - New password (required, min 12 chars, strength indicator)
   - Confirm new password (required, must match)
   - Warning: "This will re-encrypt all credentials" (red alert)

2. Process flow:
   1. Verify current password
   2. Derive new vault key from new password
   3. Decrypt all credentials with old key
   4. Re-encrypt all credentials with new key
   5. Update master password hash
   6. Update encrypted vault key
   7. Sign out (force re-login)

3. Progress indication:
   - Show loading dialog during re-encryption
   - Display progress: "Re-encrypting 5 of 23 credentials..."
   - Cannot cancel once started

4. Error handling:
   - Current password incorrect → show error, stay on dialog
   - New password too weak → show error
   - Re-encryption fails → rollback, show error, log details

Implementation approach:
- Use existing changeMasterPassword() from UserRepositoryImpl
- Add batch re-encryption in CredentialRepositoryImpl
- Show progress with linear progress bar

Files to create:
- src/presentation/components/ChangeMasterPasswordDialog.tsx (300-400 lines)
- src/presentation/components/ReEncryptionProgress.tsx (100-150 lines)

Files to modify:
- src/presentation/pages/SettingsPage.tsx (add Change Password button)
- src/data/repositories/CredentialRepositoryImpl.ts (add reEncryptAll method)

Re-encryption logic:
```typescript
async reEncryptAll(oldKey: CryptoKey, newKey: CryptoKey, onProgress?: (current: number, total: number) => void): Promise<void> {
  const allCredentials = await this.findAll(oldKey);

  for (let i = 0; i < allCredentials.length; i++) {
    const cred = allCredentials[i];

    // Delete old encrypted version
    await this.delete(cred.id);

    // Save with new key (will encrypt)
    await this.save(cred, newKey);

    onProgress?.(i + 1, allCredentials.length);
  }
}
```

Test after implementation:
1. Add 10+ credentials
2. Open Settings > Change Master Password
3. Enter current password incorrectly (verify error)
4. Enter correct current password
5. Enter new password (watch strength indicator)
6. Confirm new password
7. Verify re-encryption progress shows
8. After completion, verify signed out
9. Sign in with new password
10. Verify all credentials decrypt correctly
```

**Success Criteria:**
- [ ] Current password validation works
- [ ] New password strength validated
- [ ] Re-encryption completes successfully
- [ ] Progress indicator displays
- [ ] Forces signout after change
- [ ] All credentials accessible with new password

**Files to Create:**
- `src/presentation/components/ChangeMasterPasswordDialog.tsx` (300-400 lines)
- `src/presentation/components/ReEncryptionProgress.tsx` (100-150 lines)

**Files to Modify:**
- `src/presentation/pages/SettingsPage.tsx`
- `src/data/repositories/CredentialRepositoryImpl.ts` (add reEncryptAll method)

**Time Estimate:** 5-7 hours

---

### Phase 3.3: Import/Export Functionality

**Prompt for Claude Code:**
```
Implement secure vault export and import with encryption.

Current state: Basic import/export in CredentialRepositoryImpl exists but no encryption or UI

Requirements:

**Export:**
1. Format: Encrypted JSON file
2. Encryption: AES-256-GCM with user-provided password (not master password)
3. Filename: trustvault-backup-YYYY-MM-DD.tvault
4. Contents:
   ```json
   {
     "version": "1.0",
     "exportDate": "2025-10-22T10:30:00Z",
     "credentials": [...encrypted with export password...],
     "encryptionParams": { "algorithm": "AES-256-GCM", "iterations": 600000 }
   }
   ```

5. Export dialog:
   - Export password field (required, min 12 chars)
   - Confirm export password
   - Warning: "Store export password securely, cannot recover without it"
   - Checkbox: "I have stored the export password"
   - Export button (disabled until checkbox checked)

**Import:**
1. File picker: Accept .tvault files only
2. Import dialog:
   - Show filename
   - Export password field (decrypt file)
   - Preview: "X credentials found" (after decrypt)
   - Import mode dropdown:
     - Replace all (delete existing, import new)
     - Merge (keep existing, add new, skip duplicates)
   - Warning if Replace selected

3. Duplicate detection:
   - Match by title + username
   - Show duplicate list before import
   - Options: Skip, Overwrite, Keep both

4. Progress indication:
   - "Decrypting export file..."
   - "Importing 15 of 42 credentials..."

Files to create:
- src/presentation/components/ExportDialog.tsx (250-300 lines)
- src/presentation/components/ImportDialog.tsx (350-400 lines)
- src/core/crypto/exportEncryption.ts (200-250 lines)

Files to modify:
- src/presentation/pages/SettingsPage.tsx (add Export/Import buttons)
- src/data/repositories/CredentialRepositoryImpl.ts (enhance import/export methods)

Export encryption logic:
```typescript
export async function encryptExport(
  credentials: Credential[],
  exportPassword: string
): Promise<string> {
  const salt = randomBytes(32);
  const key = await deriveKeyFromPassword(exportPassword, salt);

  const data = JSON.stringify({ credentials });
  const encrypted = await encrypt(data, key);

  return JSON.stringify({
    version: '1.0',
    exportDate: new Date().toISOString(),
    salt: btoa(String.fromCharCode(...salt)),
    credentials: encrypted,
    encryptionParams: { algorithm: 'AES-256-GCM', iterations: 600000 }
  });
}
```

Test after implementation:
1. Export 10 credentials with password "ExportPass123!"
2. Verify .tvault file downloads
3. Delete all credentials
4. Import .tvault file with correct password
5. Verify all 10 credentials restored
6. Test import with wrong password (verify error)
7. Test merge mode (add new credentials, import, verify no duplicates)
```

**Success Criteria:**
- [ ] Export encrypts vault to .tvault file
- [ ] Export password validated (min 12 chars)
- [ ] Import decrypts and restores credentials
- [ ] Wrong password shows error
- [ ] Replace mode clears existing credentials
- [ ] Merge mode handles duplicates
- [ ] Progress indicators display

**Files to Create:**
- `src/presentation/components/ExportDialog.tsx` (250-300 lines)
- `src/presentation/components/ImportDialog.tsx` (350-400 lines)
- `src/core/crypto/exportEncryption.ts` (200-250 lines)

**Files to Modify:**
- `src/presentation/pages/SettingsPage.tsx`
- `src/data/repositories/CredentialRepositoryImpl.ts`

**Time Estimate:** 6-8 hours

---

## 🎨 PHASE 4: Polish & Advanced Features

**Goal:** Enhance UX and add optional advanced features
**Time:** 18-22 hours
**Dependencies:** Phase 3 complete

### Phase 4.1: Biometric Authentication Integration

**Prompt for Claude Code:**
```
Integrate WebAuthn for biometric signin (fingerprint/face recognition).

Current state: webauthn.ts stub exists, not wired to UI

Requirements:
1. Enable in settings:
   - Settings > Security > Biometric Authentication toggle
   - On enable: trigger WebAuthn registration
   - Store credential ID in user.webAuthnCredentials

2. Signin flow enhancement:
   - If biometric enabled, show "Use Biometric" button on SigninPage
   - On click: trigger WebAuthn authentication
   - On success: derive vault key and sign in (no password entry)
   - On failure: show error, allow password entry

3. WebAuthn implementation:
   - Use platform authenticator (no external devices)
   - User verification required
   - Store credential in browser
   - Associate with user email

4. Security considerations:
   - Vault key must be encrypted with biometric-derived key
   - Store encrypted vault key separately for biometric
   - Cannot extract key without biometric verification

Implementation approach:
- Enhance webauthn.ts with full WebAuthn API calls
- Add biometric registration to Settings
- Add biometric option to SigninPage
- Store biometric-encrypted vault key in user record

Files to modify:
- src/core/auth/webauthn.ts (expand to 300-400 lines)
- src/presentation/pages/SigninPage.tsx (add biometric button)
- src/presentation/pages/SettingsPage.tsx (add biometric toggle)
- src/domain/entities/User.ts (add biometricEncryptedVaultKey field)
- src/data/repositories/UserRepositoryImpl.ts (register/authenticate methods)

WebAuthn registration flow:
```typescript
export async function registerBiometric(userId: string, userName: string): Promise<PublicKeyCredential> {
  const challenge = randomBytes(32);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: 'TrustVault', id: window.location.hostname },
    user: {
      id: new TextEncoder().encode(userId),
      name: userName,
      displayName: userName
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: 'none'
  };

  const credential = await navigator.credentials.create({ publicKey });
  return credential as PublicKeyCredential;
}
```

Test after implementation:
1. Sign in with password
2. Go to Settings > Biometric Authentication
3. Enable toggle (trigger browser biometric prompt)
4. Verify credential registered
5. Sign out
6. Click "Use Biometric" on signin page
7. Complete biometric prompt
8. Verify signed in without entering password
9. Test biometric failure (deny prompt, verify password option available)
```

**Success Criteria:**
- [ ] Biometric registration works in settings
- [ ] Biometric signin button appears
- [ ] Biometric authentication succeeds
- [ ] Vault key decrypted after biometric auth
- [ ] Password fallback available
- [ ] Works on supported browsers (Chrome, Safari, Edge)

**Files to Modify:**
- `src/core/auth/webauthn.ts` (expand to 300-400 lines)
- `src/presentation/pages/SigninPage.tsx`
- `src/presentation/pages/SettingsPage.tsx`
- `src/domain/entities/User.ts`
- `src/data/repositories/UserRepositoryImpl.ts`

**Time Estimate:** 6-8 hours

---

### Phase 4.2: Credential Categories & Organization

**Prompt for Claude Code:**
```
Enhance credential organization with visual categories and tags.

Requirements:
1. Category enhancements:
   - Icon for each category (Login: key, Payment: card, Identity: person, Note: document)
   - Color coding (Login: blue, Payment: green, Identity: purple, Note: orange)
   - Category badge on credential cards
   - Filter by category in dashboard

2. Tags system:
   - Add optional tags field to credentials (array of strings)
   - Tag input with autocomplete (suggest existing tags)
   - Show tags as chips on credential card
   - Filter by tags in dashboard
   - Tag management in settings (rename, delete)

3. Favorites:
   - Star icon on card (toggle favorite)
   - Favorites section at top of dashboard
   - Quick filter: "Show favorites only"

4. Recently used:
   - Track lastAccessedAt timestamp on credentials
   - Update on view/copy action
   - "Recently used" section in dashboard
   - Sort by last accessed

Implementation:
- Enhance Credential entity with tags, favorite, lastAccessedAt
- Update repository to handle new fields
- Add tag input component
- Enhance dashboard with sections

Files to create:
- src/presentation/components/TagInput.tsx (200-250 lines)
- src/presentation/components/CategoryIcon.tsx (80-100 lines)
- src/presentation/components/CredentialSection.tsx (150-200 lines)

Files to modify:
- src/domain/entities/Credential.ts (add tags, lastAccessedAt)
- src/data/repositories/CredentialRepositoryImpl.ts (update methods)
- src/presentation/pages/DashboardPage.tsx (add sections, enhance filters)
- src/presentation/pages/AddCredentialPage.tsx (add tags input)
- src/presentation/pages/EditCredentialPage.tsx (add tags input)
- src/presentation/components/CredentialCard.tsx (add category icon, tags chips)

Test after implementation:
1. Add credential with tags: "work", "important"
2. Verify tags autocomplete on second credential
3. Mark credential as favorite (star icon)
4. Verify favorite section shows at top
5. Copy password from credential
6. Verify moves to "Recently used" section
7. Filter by category and tags
```

**Success Criteria:**
- [ ] Category icons and colors display
- [ ] Tags input with autocomplete works
- [ ] Tags filter credentials
- [ ] Favorites section displays correctly
- [ ] Recently used tracks access
- [ ] All filters work together

**Files to Create:**
- `src/presentation/components/TagInput.tsx` (200-250 lines)
- `src/presentation/components/CategoryIcon.tsx` (80-100 lines)
- `src/presentation/components/CredentialSection.tsx` (150-200 lines)

**Files to Modify:**
- `src/domain/entities/Credential.ts`
- `src/data/repositories/CredentialRepositoryImpl.ts`
- `src/presentation/pages/DashboardPage.tsx`
- `src/presentation/pages/AddCredentialPage.tsx`
- `src/presentation/pages/EditCredentialPage.tsx`
- `src/presentation/components/CredentialCard.tsx`

**Time Estimate:** 6-8 hours

---

### Phase 4.3: Responsive Design & Mobile Optimization

**Prompt for Claude Code:**
```
Optimize UI for mobile devices and ensure responsive design.

Requirements:
1. Mobile navigation:
   - Bottom navigation bar on mobile (<768px)
   - Items: Credentials, Generator, Settings
   - Active state highlighting

2. Credential card mobile view:
   - Stack layout on mobile (not grid)
   - Swipe actions: swipe left reveals Edit/Delete
   - Tap to view details (full-screen dialog)
   - Quick actions bar at bottom (Copy Username, Copy Password)

3. Touch optimizations:
   - Larger tap targets (min 44x44px)
   - No hover states on mobile
   - Pull-to-refresh on dashboard
   - Swipe gestures for actions

4. Responsive breakpoints:
   - Mobile: <768px (1 column)
   - Tablet: 768px-1024px (2 columns)
   - Desktop: >1024px (3 columns)

5. Mobile-specific features:
   - Autofocus password field on add/edit
   - Prevent zoom on input focus (viewport meta)
   - Haptic feedback on actions (if supported)

Files to create:
- src/presentation/components/MobileNavigation.tsx (150-200 lines)
- src/presentation/components/SwipeableCredentialCard.tsx (250-300 lines)
- src/presentation/components/CredentialDetailsDialog.tsx (200-250 lines)
- src/presentation/hooks/useSwipeGesture.ts (150-200 lines)

Files to modify:
- src/presentation/App.tsx (conditional navigation)
- src/presentation/pages/DashboardPage.tsx (responsive grid)
- index.html (update viewport meta)

Swipe gesture implementation:
```typescript
export function useSwipeGesture(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onSwipeLeft?.();
    }
    if (isRightSwipe) {
      onSwipeRight?.();
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
```

Test after implementation:
1. Test on mobile viewport (DevTools responsive mode)
2. Verify bottom navigation appears on mobile
3. Swipe credential card left (verify Edit/Delete reveal)
4. Tap credential (verify full-screen details dialog)
5. Test pull-to-refresh on dashboard
6. Verify touch targets large enough
7. Test on tablet viewport (2-column layout)
8. Test on desktop (3-column layout)
```

**Success Criteria:**
- [ ] Bottom navigation on mobile
- [ ] Swipe gestures work
- [ ] Tap targets meet accessibility standards
- [ ] Responsive grid layouts
- [ ] Pull-to-refresh functional
- [ ] No zoom on input focus

**Files to Create:**
- `src/presentation/components/MobileNavigation.tsx` (150-200 lines)
- `src/presentation/components/SwipeableCredentialCard.tsx` (250-300 lines)
- `src/presentation/components/CredentialDetailsDialog.tsx` (200-250 lines)
- `src/presentation/hooks/useSwipeGesture.ts` (150-200 lines)

**Files to Modify:**
- `src/presentation/App.tsx`
- `src/presentation/pages/DashboardPage.tsx`
- `index.html`

**Time Estimate:** 6-8 hours

---

## 🧪 PHASE 5: Testing & Quality Assurance

**Goal:** Comprehensive testing and bug fixes
**Time:** 18-24 hours
**Dependencies:** Phase 4 complete

### Phase 5.1: Unit Tests with Vitest

**Prompt for Claude Code:**
```
Implement comprehensive unit tests for core functionality.

Requirements:
1. Test coverage targets:
   - Encryption/Decryption: 100% coverage
   - Password hashing: 100% coverage
   - TOTP generation: 100% coverage
   - Repository methods: 90% coverage
   - Utility functions: 90% coverage

2. Test files to create:

   **Core Crypto Tests:**
   - src/core/crypto/__tests__/encryption.test.ts
     - Test encrypt/decrypt roundtrip
     - Test key derivation
     - Test invalid inputs
     - Test different data types

   - src/core/crypto/__tests__/password.test.ts
     - Test scrypt hashing
     - Test password verification
     - Test password strength analysis
     - Test password generation

   **Core Auth Tests:**
   - src/core/auth/__tests__/totp.test.ts
     - Test TOTP generation with known vectors
     - Test time-based code changes
     - Test base32 decoding

   **Repository Tests:**
   - src/data/repositories/__tests__/UserRepositoryImpl.test.ts
     - Test createUser
     - Test authenticateWithPassword
     - Test changeMasterPassword
     - Mock IndexedDB with fake-indexeddb

   - src/data/repositories/__tests__/CredentialRepositoryImpl.test.ts
     - Test save/findById/findAll/delete
     - Test encryption on save
     - Test decryption on read
     - Mock IndexedDB

3. Test utilities:
   - Mock IndexedDB with fake-indexeddb package
   - Mock Web Crypto API
   - Test fixtures for sample data

4. Running tests:
   ```bash
   npm run test          # Run all tests
   npm run test:watch    # Watch mode
   npm run test:coverage # Coverage report
   ```

Example test structure:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encrypt, decrypt, deriveKeyFromPassword } from '../encryption';

describe('Encryption', () => {
  let testKey: CryptoKey;

  beforeEach(async () => {
    const salt = new Uint8Array(32);
    testKey = await deriveKeyFromPassword('test-password', salt);
  });

  it('should encrypt and decrypt text correctly', async () => {
    const plaintext = 'sensitive data';
    const encrypted = await encrypt(plaintext, testKey);
    const decrypted = await decrypt(encrypted, testKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', async () => {
    const plaintext = 'test';
    const encrypted1 = await encrypt(plaintext, testKey);
    const encrypted2 = await encrypt(plaintext, testKey);

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
  });
});
```

Files to create:
- src/core/crypto/__tests__/encryption.test.ts (200-300 lines)
- src/core/crypto/__tests__/password.test.ts (250-350 lines)
- src/core/auth/__tests__/totp.test.ts (150-200 lines)
- src/data/repositories/__tests__/UserRepositoryImpl.test.ts (400-500 lines)
- src/data/repositories/__tests__/CredentialRepositoryImpl.test.ts (400-500 lines)
- src/test/setup.ts (test configuration)
- src/test/mocks.ts (mock utilities)

Dependencies to add:
```json
"devDependencies": {
  "vitest": "^1.0.0",
  "@vitest/ui": "^1.0.0",
  "fake-indexeddb": "^5.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/user-event": "^14.0.0"
}
```

Test after implementation:
```bash
npm run test
# Verify all tests pass
# Check coverage report
npm run test:coverage
# Target: >85% coverage overall
```
```

**Success Criteria:**
- [ ] All unit tests pass
- [ ] Coverage >85% overall
- [ ] Encryption tests: 100%
- [ ] Password tests: 100%
- [ ] TOTP tests: 100%
- [ ] Repository tests: 90%

**Files to Create:**
- Multiple test files (~1500-2000 lines total)
- Test utilities and mocks

**Time Estimate:** 10-12 hours

---

### Phase 5.2: Integration Tests

**Prompt for Claude Code:**
```
Create integration tests for end-to-end workflows.

Requirements:
1. Test complete user flows:
   - Signup → Add credential → Signout → Signin → Read credential
   - Generate password → Use in credential → Save → Verify
   - Change master password → Re-encrypt → Signin → Read
   - Export vault → Import vault → Verify data integrity
   - Enable biometric → Signin with biometric

2. Test approach:
   - Use Testing Library for React components
   - Mock IndexedDB with fake-indexeddb
   - Use real crypto implementations
   - Test full component tree (not isolated units)

3. Files to create:
   - src/__tests__/integration/auth-flow.test.tsx
   - src/__tests__/integration/credential-crud.test.tsx
   - src/__tests__/integration/password-generator.test.tsx
   - src/__tests__/integration/master-password-change.test.tsx
   - src/__tests__/integration/import-export.test.tsx

Example integration test:
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '@/presentation/App';

describe('Complete Auth Flow', () => {
  it('should signup, add credential, signout, signin, and read credential', async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><App /></BrowserRouter>);

    // Should redirect to signup (no users exist)
    await waitFor(() => {
      expect(screen.getByText(/create account/i)).toBeInTheDocument();
    });

    // Fill signup form
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/master password/i), 'TestPassword123!');
    await user.type(screen.getByLabelText(/confirm/i), 'TestPassword123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Should navigate to dashboard
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Add credential
    await user.click(screen.getByRole('button', { name: /add/i }));
    await user.type(screen.getByLabelText(/title/i), 'Test Site');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'MySecret123');
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Verify credential appears
    await waitFor(() => {
      expect(screen.getByText('Test Site')).toBeInTheDocument();
    });

    // Sign out
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    // Sign in
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'TestPassword123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Verify credential still visible
    await waitFor(() => {
      expect(screen.getByText('Test Site')).toBeInTheDocument();
    });
  });
});
```

Test after implementation:
```bash
npm run test:integration
# All integration tests should pass
# Verify flows work end-to-end
```
```

**Success Criteria:**
- [ ] Auth flow test passes
- [ ] CRUD operations test passes
- [ ] Password generator test passes
- [ ] Master password change test passes
- [ ] Import/export test passes

**Files to Create:**
- 5 integration test files (~2000-2500 lines total)

**Time Estimate:** 8-10 hours

---

### Phase 5.3: Security Audit & Penetration Testing

**Prompt for Claude Code:**
```
Conduct security audit against OWASP standards and fix vulnerabilities.

Requirements:
1. OWASP Mobile Top 10 2025 checklist:
   - M1: Improper Credentials Usage
   - M2: Supply Chain Security
   - M3: Insecure Authentication
   - M4: Insufficient Input Validation
   - M5: Insecure Communication
   - M6: Inadequate Privacy Controls
   - M7: Insufficient Binary Protection
   - M8: Security Misconfiguration
   - M9: Insecure Data Storage
   - M10: Insufficient Cryptography

2. Manual security tests:

   **Crypto validation:**
   - Verify scrypt parameters (N=32768, r=8, p=1)
   - Verify AES-256-GCM mode with unique IVs
   - Verify PBKDF2 iterations (600k)
   - Check for hardcoded keys or secrets
   - Verify secure random generation

   **Input validation:**
   - Test SQL injection (IndexedDB queries)
   - Test XSS in credential titles/notes
   - Test path traversal in import/export
   - Test buffer overflow in password fields

   **Session management:**
   - Test auto-lock enforcement
   - Test session fixation
   - Test concurrent sessions
   - Verify key clearing on lock

   **Storage security:**
   - Inspect IndexedDB (credentials encrypted?)
   - Check localStorage for sensitive data
   - Verify sessionStorage cleared on signout
   - Test data remnants after signout

3. Automated tools:
   ```bash
   npm run lighthouse:security  # Security audit
   npm audit                    # Dependency vulnerabilities
   npm run test:security        # Custom security tests
   ```

4. Security test file:
   - src/__tests__/security/crypto-validation.test.ts
   - src/__tests__/security/input-validation.test.ts
   - src/__tests__/security/session-security.test.ts
   - src/__tests__/security/storage-security.test.ts

Example security test:
```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword } from '@/core/crypto/password';

describe('Crypto Security', () => {
  it('should use secure scrypt parameters', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);

    // Verify format: scrypt$N$r$p$salt$hash
    const parts = hash.split('$');
    expect(parts[0]).toBe('scrypt');
    expect(parseInt(parts[1])).toBeGreaterThanOrEqual(32768); // N >= 2^15
    expect(parseInt(parts[2])).toBeGreaterThanOrEqual(8); // r >= 8
  });

  it('should produce different hashes for same password', async () => {
    const password = 'test123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2); // Unique salt per hash
  });
});
```

Create security report:
- SECURITY_AUDIT_REPORT.md
  - List all tests performed
  - Document any vulnerabilities found
  - Provide remediation steps
  - Risk assessment (Critical/High/Medium/Low)

Test after implementation:
```bash
npm run test:security
npm audit fix
npm run lighthouse:security
# Verify all security tests pass
# No critical/high vulnerabilities in dependencies
```
```

**Success Criteria:**
- [ ] All OWASP checks pass
- [ ] No critical/high vulnerabilities
- [ ] Input validation comprehensive
- [ ] Storage encrypted
- [ ] Security report generated
- [ ] Dependencies up to date

**Files to Create:**
- Security test files (~1000-1500 lines)
- SECURITY_AUDIT_REPORT.md

**Time Estimate:** 6-8 hours

---

## 🚀 PHASE 6: Production Readiness

**Goal:** Optimize for production deployment
**Time:** 12-15 hours
**Dependencies:** Phase 5 complete

### Phase 6.1: Performance Optimization

**Prompt for Claude Code:**
```
Optimize app performance for Lighthouse score >90.

Requirements:
1. Code splitting:
   - Lazy load routes (Dashboard, Settings, Add/Edit pages)
   - Lazy load heavy components (TOTP, PasswordGenerator)
   - Use React.lazy() and Suspense

2. Bundle optimization:
   - Analyze bundle size: npm run build && npm run analyze
   - Move large libraries to separate chunks
   - Remove unused dependencies
   - Tree-shake @noble/hashes (only import used functions)

3. Image optimization:
   - Compress PWA icons (use imagemin)
   - Use WebP format with PNG fallback
   - Add loading="lazy" to images

4. Caching strategy:
   - Service worker cache all static assets
   - Cache-first for fonts/images
   - Network-first for API (none currently)
   - Precache critical routes

5. Runtime performance:
   - Use React.memo for expensive components
   - UseMemo for heavy computations
   - UseCallback for event handlers
   - Debounce search input (already done in Phase 1.4)

Implementation steps:
1. Add lazy loading to routes:
```typescript
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AddCredentialPage = lazy(() => import('./pages/AddCredentialPage'));
```

2. Update vite.config.ts manualChunks:
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'mui-vendor': ['@mui/material', '@mui/icons-material'],
  'security-vendor': ['@noble/hashes'],
  'storage-vendor': ['dexie']
}
```

3. Optimize service worker workbox config:
```typescript
runtimeCaching: [
  {
    urlPattern: /^https:\/\/fonts\./,
    handler: 'CacheFirst',
    options: { cacheName: 'fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } }
  },
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
    handler: 'CacheFirst',
    options: { cacheName: 'images', expiration: { maxEntries: 50 } }
  }
]
```

Run Lighthouse audit:
```bash
npm run build
npm run preview
# In another terminal:
npm run lighthouse
# Target scores: >90 all categories
```

Files to modify:
- src/presentation/App.tsx (add lazy loading)
- vite.config.ts (optimize chunks)
- public/manifest.json (verify optimized)

Test after implementation:
1. Build production: npm run build
2. Check bundle sizes: ls -lh dist/assets/
3. Run Lighthouse: npm run lighthouse
4. Verify all scores >90
5. Test lazy loading (slow 3G in DevTools)
```

**Success Criteria:**
- [ ] Lighthouse Performance >90
- [ ] Lighthouse Accessibility >90
- [ ] Lighthouse Best Practices >90
- [ ] Lighthouse SEO >90
- [ ] Bundle size <500KB total
- [ ] Initial load <2s

**Files to Modify:**
- `src/presentation/App.tsx`
- `vite.config.ts`

**Time Estimate:** 5-6 hours

---

### Phase 6.2: PWA Enhancements

**Prompt for Claude Code:**
```
Enhance PWA features for installability and offline functionality.

Requirements:
1. Install prompt:
   - Show custom install banner after 2 visits
   - "Install TrustVault" button in settings
   - Use beforeinstallprompt event
   - Track install status

2. Offline functionality:
   - Show offline indicator when network lost
   - Queue actions when offline (future: sync when online)
   - Cache all routes for offline access
   - Offline-first architecture verified

3. App updates:
   - Detect new version available
   - Show "Update available" snackbar
   - Prompt user to reload
   - Update service worker

4. Splash screen:
   - Custom splash screen for iOS/Android
   - Match app theme colors
   - Show TrustVault logo

5. Manifest enhancements:
   - Add shortcuts (for quick actions)
   - Add screenshots for install prompt
   - Verify theme colors
   - Add description

manifest.json shortcuts:
```json
{
  "shortcuts": [
    {
      "name": "Add Credential",
      "url": "/credentials/add",
      "icons": [{ "src": "/pwa-192x192.png", "sizes": "192x192" }]
    },
    {
      "name": "Generate Password",
      "url": "/generator",
      "icons": [{ "src": "/pwa-192x192.png", "sizes": "192x192" }]
    }
  ]
}
```

PWA install component:
```typescript
export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  };

  if (isInstalled || !installPrompt) return null;

  return (
    <Button onClick={handleInstall} variant="contained">
      Install TrustVault
    </Button>
  );
}
```

Files to create:
- src/presentation/components/InstallPrompt.tsx (150-200 lines)
- src/presentation/components/UpdatePrompt.tsx (100-150 lines)
- src/presentation/components/OfflineIndicator.tsx (80-100 lines)

Files to modify:
- public/manifest.json (add shortcuts, screenshots)
- src/presentation/App.tsx (add offline indicator, update prompt)
- src/presentation/pages/SettingsPage.tsx (add install button)

Test after implementation:
1. Build production version
2. Serve with preview
3. Test install prompt appears
4. Install app
5. Verify shortcuts in app launcher
6. Test offline mode (DevTools Network tab)
7. Test update prompt (deploy new version)
```

**Success Criteria:**
- [ ] Install prompt works
- [ ] Shortcuts appear after install
- [ ] Offline indicator displays
- [ ] Update prompt appears
- [ ] PWA Lighthouse score 100

**Files to Create:**
- `src/presentation/components/InstallPrompt.tsx`
- `src/presentation/components/UpdatePrompt.tsx`
- `src/presentation/components/OfflineIndicator.tsx`

**Files to Modify:**
- `public/manifest.json`
- `src/presentation/App.tsx`
- `src/presentation/pages/SettingsPage.tsx`

**Time Estimate:** 4-5 hours

---

### Phase 6.3: Documentation & Deployment

**Prompt for Claude Code:**
```
Finalize documentation and prepare for deployment.

Requirements:
1. Update README.md:
   - Feature list (complete)
   - Screenshots (dashboard, add credential, settings)
   - Installation instructions
   - Security overview
   - Browser compatibility
   - Deployment guide

2. Create USER_GUIDE.md:
   - Getting started
   - Creating account
   - Adding credentials
   - Generating passwords
   - TOTP setup
   - Import/export
   - Security best practices
   - Troubleshooting

3. Create DEPLOYMENT.md:
   - Build instructions
   - Environment variables (if any)
   - Hosting options (Vercel, Netlify, GitHub Pages)
   - HTTPS requirements
   - CSP configuration
   - Domain setup

4. Update CONTRIBUTING.md:
   - Development setup
   - Code standards
   - Testing requirements
   - PR process

5. Create CHANGELOG.md:
   - v1.0.0 initial release
   - All features implemented
   - Known limitations

6. Security documentation:
   - Update SECURITY.md
   - Document encryption details
   - Vulnerability reporting
   - Security best practices

7. License and legal:
   - Verify LICENSE file (MIT)
   - Add PRIVACY_POLICY.md
   - Add TERMS_OF_SERVICE.md (if needed)

Deployment checklist:
- [ ] All tests passing
- [ ] Lighthouse scores >90
- [ ] No console errors/warnings
- [ ] Security audit complete
- [ ] Documentation complete
- [ ] Build succeeds
- [ ] Production environment variables set
- [ ] HTTPS configured
- [ ] Domain configured
- [ ] Service worker working
- [ ] PWA installable

Files to create:
- USER_GUIDE.md (comprehensive user documentation)
- DEPLOYMENT.md (hosting and deployment guide)
- CHANGELOG.md (version history)
- PRIVACY_POLICY.md (privacy statement)

Files to update:
- README.md (complete rewrite)
- SECURITY.md (add implementation details)
- CONTRIBUTING.md (development workflow)

Deployment scripts:
```json
{
  "scripts": {
    "deploy:vercel": "vercel --prod",
    "deploy:netlify": "netlify deploy --prod",
    "deploy:gh-pages": "npm run build && gh-pages -d dist"
  }
}
```

Test deployment:
1. Deploy to staging environment
2. Test all functionality
3. Run Lighthouse on deployed version
4. Verify HTTPS works
5. Test PWA install from deployed site
6. Verify service worker updates
```

**Success Criteria:**
- [ ] All documentation complete
- [ ] README has screenshots
- [ ] Deployment guide tested
- [ ] Successfully deployed to hosting
- [ ] PWA installable from deployed URL
- [ ] All features work in production

**Files to Create:**
- USER_GUIDE.md
- DEPLOYMENT.md
- CHANGELOG.md
- PRIVACY_POLICY.md

**Files to Update:**
- README.md
- SECURITY.md
- CONTRIBUTING.md

**Time Estimate:** 5-6 hours

---

## 📊 Summary & Timeline

### Total Development Time: 105-130 hours

| Phase | Goal | Time | Status |
|-------|------|------|--------|
| Phase 0 | Critical Bug Fixes | 2-3h | 🔴 URGENT |
| Phase 1 | Core Credential Management | 18-22h | ⏳ Ready |
| Phase 2 | Advanced Security Features | 20-25h | ⏳ Waiting |
| Phase 3 | Settings & User Experience | 15-18h | ⏳ Waiting |
| Phase 4 | Polish & Advanced Features | 18-22h | ⏳ Waiting |
| Phase 5 | Testing & Quality Assurance | 18-24h | ⏳ Waiting |
| Phase 6 | Production Readiness | 12-15h | ⏳ Waiting |

### Sprint Planning (2-week sprints)

**Sprint 1 (Week 1-2):** Phase 0 + Phase 1
**Sprint 2 (Week 3-4):** Phase 2
**Sprint 3 (Week 5-6):** Phase 3 + Phase 4.1
**Sprint 4 (Week 7-8):** Phase 4.2-4.3 + Phase 5.1
**Sprint 5 (Week 9-10):** Phase 5.2-5.3 + Phase 6

**Production Launch:** End of Week 10

---

## 🎯 Milestone Checklist

### Alpha (Current - 60% Complete)
- [x] Authentication (signin/signup)
- [x] Basic encryption
- [x] Database setup
- [x] PWA infrastructure
- [ ] Fix critical bugs

### Beta (After Phase 1 - 75% Complete)
- [ ] Complete CRUD operations
- [ ] Dashboard with all features
- [ ] Search and filtering
- [ ] Password generator

### Release Candidate (After Phase 4 - 90% Complete)
- [ ] All advanced features
- [ ] TOTP/2FA
- [ ] Biometric auth
- [ ] Import/export
- [ ] Mobile optimized

### Production (After Phase 6 - 100% Complete)
- [ ] All tests passing
- [ ] Security audit complete
- [ ] Performance optimized
- [ ] Documentation complete
- [ ] Deployed to production

---

## 📖 How to Use This Roadmap

### For Each Phase:

1. **Read the entire phase** before starting
2. **Copy the "Prompt for Claude Code"** exactly as written
3. **Paste into Claude Code** interface
4. **Wait for implementation** to complete
5. **Run verification tests** in the Success Criteria
6. **Check off completed items** in the roadmap
7. **Move to next phase** only after current phase complete

### Best Practices:

- ✅ **Complete phases in order** (dependencies matter)
- ✅ **Test after each phase** (don't accumulate bugs)
- ✅ **Commit frequently** (after each major feature)
- ✅ **Run type-check** before committing
- ✅ **Update this roadmap** as you progress
- ❌ **Don't skip Phase 0** (critical bugs block everything)
- ❌ **Don't skip testing** (technical debt accumulates)

### Tracking Progress:

Update this file with:
- Change ⏳ to ✅ when phase complete
- Add notes in phase sections about deviations
- Update time estimates based on actual time spent
- Document any additional bugs found

---

## 🔄 Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2025-10-22 | 1.0 | Initial roadmap created |

---

**Next Action:** Start with Phase 0.1 - Fix Vault Key Decryption
