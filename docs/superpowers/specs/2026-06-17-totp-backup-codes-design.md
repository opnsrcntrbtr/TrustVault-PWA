# TOTP Backup Codes — Design Spec

**Date:** 2026-06-17  
**Status:** Approved  
**Gap reference:** `GAP_ANALYSIS.md` §17 #5 — "TOTP SMS/backup codes not implemented (19/25 tests passing); core RFC 6238 TOTP works; SMS fallback and backup codes are stubs."

---

## Goal

Complete TOTP 2FA by adding offline backup codes as a fallback when the authenticator app is lost, unavailable, or inaccessible. Enable users to regain access to locked credentials without requiring SMS or external infrastructure.

---

## Decisions (from brainstorming)

1. **Backup codes only** (not SMS) — PWA has no backend; SMS requires third-party service and violates zero-CDN/zero-egress architecture.
2. **Per-credential** — Each credential with TOTP has its own 12 backup codes (granular, doesn't compromise all TOTP secrets if one set is lost).
3. **Auto-generate at setup** — When user enables TOTP, codes auto-generate and display in modal (required acknowledgment).
4. **Dedicated recovery flow** — "Lost authenticator?" button in credential detail view, separate from normal TOTP entry.
5. **Regeneration supported** — User can regenerate codes in Settings/edit form; old codes invalidated.
6. **Encrypted storage** — Backup codes stored encrypted with credential (alongside TOTP secret).

---

## Data Model

### BackupCode Type
```typescript
interface BackupCode {
  id: string;              // UUID, unique per code
  code: string;            // 8-digit numeric (e.g., "12345678")
  consumed: boolean;       // true after used for recovery
  lastUsedAt?: number;     // timestamp (milliseconds) when consumed
}
```

### Credential Entity Extension
Add to existing `Credential`:
```typescript
totpSecret?: string;       // (already exists, RFC 6238 secret)
backupCodes?: BackupCode[]; // new: array of 12 backup codes
```

Storage:
- `backupCodes` encrypted with vault key (same as `totpSecret`)
- Stored in IndexedDB as encrypted JSON blob
- Decrypted on credential load, encrypted on save

### Code Generation
- **Count:** 12 codes per credential
- **Format:** 8-digit numeric (0–99999999)
- **Uniqueness:** No duplicates within the set
- **Entropy:** `Math.random()` via Web Crypto API (sufficiently random for UX fallback)

---

## Components & UI Flows

### Component 1: `BackupCodesModal`
Displays generated backup codes after setup or regeneration.

**Props:**
```typescript
interface BackupCodesModalProps {
  codes: BackupCode[];
  onConfirm: () => void;
  title?: string;
}
```

**Behavior:**
- **Title:** "Save your backup codes" (or custom via prop)
- **Warning message:** "Keep these safe. Each code can only be used once. If you lose your authenticator, use these to regain access."
- **Display:** 12 codes in 2×6 grid, monospace font (e.g., `12345678`), left-aligned
- **Copy actions:**
  - Per-code: IconButton with `ContentCopy` icon, shows "Copied!" snackbar
  - Bulk: "Copy all" button → copies space-separated list to clipboard
- **Download option:** "Download as .txt" button → `backup-codes-[credential-title]-[date].txt`
- **Dismiss:** "I've saved these" button (primary color, required before modal closes)
- **Error state:** If copy/download fails, show inline error snackbar

**Styling:** Material-UI Paper/Dialog, matches existing modals (ErrorBoundary, ExportDialog)

### Component 2: `BackupCodeInput`
Recovery modal for entering a backup code to regain access.

**Props:**
```typescript
interface BackupCodeInputProps {
  credentialTitle: string;
  onSuccess: (consumedCode: BackupCode) => void;
  onCancel: () => void;
}
```

**Behavior:**
- **Title:** `Recover access to "${credentialTitle}"`
- **Instruction:** "Enter one of your backup codes to regain access without your authenticator."
- **Input field:** 
  - Placeholder: "e.g., 12345678"
  - Auto-format: Strips spaces, rejects non-digits
  - Max length: 8 characters
  - Validation on blur: Check format before submit
- **Error states:**
  - Invalid format: "Code must be 8 digits"
  - Code not found: "This code doesn't exist"
  - Code already consumed: "This code was already used on [date/time]"
  - Crypto failure: "Failed to verify code, try again"
- **Actions:**
  - "Use this code" button (primary, disabled until valid format)
  - "Cancel" button
- **On success:** Consumes code (sets `consumed: true`, `lastUsedAt: Date.now()`), calls `onSuccess()`, modal closes

**Styling:** Material-UI Dialog, consistent with existing modals

### Component 3: Credential Form Enhancement

**AddCredentialPage / EditCredentialPage:**

**At TOTP setup:**
- After user enters TOTP secret and confirms it's valid:
  - Auto-generate 12 backup codes
  - Trigger `BackupCodesModal` (modal blocks form submission)
  - User must click "I've saved these" before form can be submitted
  - Codes stored in credential on save

**In edit mode (TOTP already enabled):**
- Show read-only badge: "12 backup codes saved" (gray, non-interactive)
- Add button: "Regenerate backup codes" (secondary color, icon: `Refresh`)
- On click:
  - Confirm: "Regenerate codes? Old codes will no longer work."
  - If confirmed: Auto-generate new 12 codes → trigger `BackupCodesModal` with new codes
  - Old codes deleted, new codes stored on save

### Recovery Flow: "Lost Authenticator?"

**Trigger:** Button in CredentialDetailsDialog when credential has TOTP + backup codes

**Flow:**
1. User views credential detail, clicks "Lost authenticator?" button
2. `BackupCodeInput` modal opens
3. User enters backup code (8 digits)
4. Code validated:
   - Exists in `credential.backupCodes`
   - Not yet consumed
   - Format correct
5. If valid: Code marked `consumed: true`, `lastUsedAt: timestamp`, saved to DB
6. Modal closes, credential accessible without TOTP requirement
7. Success message: "Backup code used. You can now access this credential without your authenticator."

**Error recovery:** User can try another backup code (up to 12 attempts per credential)

---

## Encryption & Persistence

### Key Points
- Backup codes stored **encrypted** alongside TOTP secret in the `Credential` entity
- Encryption key: vault key (same as credential password, TOTP secret)
- On credential save: `backupCodes` array serialized to JSON, encrypted with AES-256-GCM
- On credential load: encrypted blob decrypted, `backupCodes` array populated
- Consumed codes persist immediately on use (encrypted)

### No Persistence Bypass
- Backup codes **never** stored in plain text
- **Never** logged to console (security rule violation)
- **Never** sent to external services (zero-CDN/zero-egress)

---

## Error Handling

### Generation Failures
| Scenario | Message | Recovery |
|----------|---------|----------|
| Crypto failure (rare) | "Failed to generate codes, try again" | User clicks "Retry" button, re-generates |
| Storage failure | "Failed to save backup codes" | Show retry option + cancel to exit modal |

### Recovery Failures
| Scenario | Message | User Action |
|----------|---------|-------------|
| Invalid format | "Code must be 8 digits" | Re-enter valid code |
| Code not found | "This code doesn't exist" | Check saved codes, try another |
| Code consumed | "This code was already used on [date]" | Use a different backup code |
| Crypto failure | "Failed to verify code, try again" | Retry or cancel |
| DB error | "Failed to access credential, try again" | Retry or refresh page |

### Regeneration
- **Confirm dialog:** "Regenerate codes? Old codes will no longer work."
- **On confirm:** New codes generated, modal shown, old codes deleted on save
- **On cancel:** No changes, modal closes

---

## Testing Strategy

### Unit Tests (`src/core/auth/totp.test.ts` expansion)

**New functions to add:**

1. `generateBackupCodes(count: number = 12): BackupCode[]`
   - ✅ Generates exactly `count` codes
   - ✅ Each code is 8-digit numeric string
   - ✅ No duplicates within set
   - ✅ Each code has unique `id` (UUID)
   - ✅ `consumed` defaults to `false`

2. `validateBackupCode(code: string): boolean`
   - ✅ Accepts "12345678" (8 digits)
   - ✅ Accepts "1234 5678" (with space, strips it)
   - ✅ Rejects non-numeric
   - ✅ Rejects wrong length

3. `consumeBackupCode(codes: BackupCode[], code: string): BackupCode | null`
   - ✅ Returns matching code if found + not consumed
   - ✅ Marks code `consumed: true` and `lastUsedAt: Date.now()`
   - ✅ Returns null if not found or already consumed
   - ✅ Does not mutate original array (returns new array)

**Test coverage:**
```typescript
describe('Backup Codes', () => {
  it('generates 12 unique 8-digit codes', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(12);
    expect(codes.every(c => /^\d{8}$/.test(c.code))).toBe(true);
    expect(new Set(codes.map(c => c.code)).size).toBe(12); // no duplicates
  });

  it('validates code format with optional space', () => {
    expect(validateBackupCode('12345678')).toBe(true);
    expect(validateBackupCode('1234 5678')).toBe(true);
    expect(validateBackupCode('1234567')).toBe(false); // wrong length
    expect(validateBackupCode('1234567a')).toBe(false); // non-numeric
  });

  it('consumes a code and marks it used', () => {
    const codes = generateBackupCodes();
    const consumed = consumeBackupCode(codes, codes[0]!.code);
    expect(consumed).not.toBeNull();
    expect(consumed!.consumed).toBe(true);
    expect(consumed!.lastUsedAt).toBeDefined();
  });

  it('returns null for non-existent code', () => {
    const codes = generateBackupCodes();
    expect(consumeBackupCode(codes, '99999999')).toBeNull();
  });

  it('returns null for already-consumed code', () => {
    const codes = generateBackupCodes();
    const first = consumeBackupCode(codes, codes[0]!.code)!;
    const second = consumeBackupCode([first], codes[0]!.code);
    expect(second).toBeNull();
  });
});
```

### Component Tests

**`BackupCodesModal.test.tsx`:**
- ✅ Displays 12 codes in grid
- ✅ Copy per-code shows "Copied!" snackbar
- ✅ Copy all copies space-separated list
- ✅ Download button initiates file download
- ✅ "I've saved these" button closes modal, calls `onConfirm()`
- ✅ Modal cannot be dismissed without clicking "I've saved these"

**`BackupCodeInput.test.tsx`:**
- ✅ Accepts 8-digit code
- ✅ Strips spaces (formats "1234 5678" → "12345678")
- ✅ Shows "Invalid format" for non-numeric
- ✅ Shows "Code not found" when code not in list
- ✅ Shows "Already used" when code consumed
- ✅ "Use this code" button calls `onSuccess()` with consumed code
- ✅ Consumed code object has `consumed: true` + `lastUsedAt` set

**Credential form integration:**
- ✅ Adding TOTP triggers `BackupCodesModal`
- ✅ Codes persist in credential on save
- ✅ Edit mode shows "Regenerate codes" button
- ✅ Regenerate modal shows new codes, old codes deleted on save

### Integration Tests (`credential-crud.test.tsx` expansion)

**End-to-end flow:**
1. Add credential with TOTP secret
2. Backup codes auto-generate + modal shown
3. User clicks "I've saved these"
4. Form submits, credential saved with codes encrypted
5. Open credential detail → click "Lost authenticator?"
6. Enter backup code
7. Code consumed, credential accessible without TOTP
8. Verify consumed code cannot be reused
9. Regenerate backup codes → old codes invalidated
10. Verify new codes work, old codes rejected

---

## Files to Create / Modify

### New Files
- `src/core/auth/backupCodes.ts` — `generateBackupCodes()`, `validateBackupCode()`, `consumeBackupCode()`
- `src/presentation/components/BackupCodesModal.tsx` — display modal
- `src/presentation/components/BackupCodeInput.tsx` — recovery modal
- `src/core/auth/__tests__/backupCodes.test.ts` — unit tests
- `src/presentation/components/__tests__/BackupCodesModal.test.tsx` — component tests
- `src/presentation/components/__tests__/BackupCodeInput.test.tsx` — component tests

### Modify
- `src/domain/entities/Credential.ts` — add `backupCodes?: BackupCode[]` field
- `src/data/repositories/CredentialRepositoryImpl.ts` — handle encryption/decryption of backup codes
- `src/presentation/pages/AddCredentialPage.tsx` — trigger `BackupCodesModal` after TOTP entry
- `src/presentation/pages/EditCredentialPage.tsx` — add "Regenerate codes" button
- `src/presentation/components/CredentialDetailsDialog.tsx` — add "Lost authenticator?" button + `BackupCodeInput` modal
- `src/__tests__/integration/credential-crud.test.tsx` — add end-to-end recovery flow test

---

## Known Limitations (Documented, Out of Scope)

1. **No SMS fallback** — PWA architecture precludes third-party SMS integration
2. **No code expiration** — Codes valid indefinitely until consumed (acceptable for a personal vault manager)
3. **No bulk operations** — Cannot bulk-consume codes or bulk-regenerate across credentials
4. **No recovery audit log** — Consumed codes logged in DB only (`lastUsedAt`), no external audit trail

---

## Success Criteria

- ✅ Generate 12 unique 8-digit backup codes on TOTP setup
- ✅ Display codes in modal with copy/download options
- ✅ Store codes encrypted with credential
- ✅ Allow regeneration in Settings/edit form
- ✅ Provide "Lost authenticator?" recovery button in credential detail
- ✅ Validate code format, check exists/not consumed
- ✅ Mark code consumed on use, persist to DB
- ✅ Unit tests: `generateBackupCodes()`, `validateBackupCode()`, `consumeBackupCode()` (100% coverage)
- ✅ Component tests: modal display, input validation, modal interaction (11+ tests)
- ✅ Integration test: full setup → recovery → reuse rejection flow
- ✅ Zero credential data logged to console
- ✅ All 19+ TOTP tests still pass (no regression)
- ✅ Backup codes show in credential detail as read-only badge

---

**End of Spec**
