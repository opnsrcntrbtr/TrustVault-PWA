# TrustVault PWA - Structured Enhancement Blueprint & Roadmap
**Comprehensive Analysis & Incremental MVP Development Plan**

**Repository**: [https://github.com/iAn-P1nt0/TrustVault-PWA](https://github.com/iAn-P1nt0/TrustVault-PWA)  
**Deployment**: [https://trust-vault-pwa.vercel.app](https://trust-vault-pwa.vercel.app)  
**Analysis Date**: November 29, 2025  
**Current Version**: 1.0.0 (Alpha - 60% Complete)  
**Technology Stack**: React 19, Vite 6, TypeScript 5.7, Dexie 4, Zustand 5, Tesseract.js 5.1.1

---

## Executive Summary

### Current State Assessment

TrustVault PWA represents a **security-first credential management solution** with a solid architectural foundation built on Clean Architecture principles. The codebase demonstrates **excellent cryptographic implementation** (AES-256-GCM, PBKDF2, Scrypt) but contains **two critical blocking bugs** that prevent actual credential retrieval after authentication.

**Security Rating**: 9.5/10 (architecture) → 7/10 (implementation with blocking bugs)

### Key Strengths
- ✅ **Production-Grade Encryption**: Military-grade AES-256-GCM with OWASP 2025 compliance
- ✅ **Clean Architecture**: Strict dependency flow (presentation → domain ← data ← core)
- ✅ **Modern Tech Stack**: React 19, Vite 6, TypeScript 5.7 with strict mode
- ✅ **Offline-First**: IndexedDB with Dexie, service worker caching
- ✅ **Type Safety**: 100% TypeScript coverage with strict compiler flags
- ✅ **Zero Telemetry**: Privacy-first, no tracking whatsoever

### Critical Gaps (MUST FIX FIRST)
1. 🔴 **Vault key not decrypted after authentication** - `UserRepositoryImpl.ts:78-107`
2. 🔴 **Credentials returned encrypted instead of decrypted** - `CredentialRepositoryImpl.ts:37-49`
3. 🟠 **Biometric authentication infrastructure exists but not integrated**
4. 🟠 **No credential add/edit UI** (backend 90% complete, UI 10%)
5. 🟠 **Export/import not encrypted** (security vulnerability)

### Technology Stack Validation Against Latest Best Practices

#### React 19 Features & Optimization[1][20][24]
- ✅ **Automatic JSX Transform**: Properly configured
- ✅ **Suspense-Ready**: Route splitting prepared
- ⚠️ **Need to Implement**: React Compiler optimizations for memoization
- ⚠️ **Need to Add**: Progressive enhancement patterns
- ⚠️ **Code Splitting**: Lazy loading for routes not yet implemented

#### Vite 6 PWA Optimization[25][28]
- ✅ **Modern Build Pipeline**: Configured correctly
- ✅ **Security Headers**: CSP properly enforced via middleware
- ⚠️ **Bundle Analysis**: Need `manualChunks` optimization
- ⚠️ **Image Optimization**: WebP support missing
- ⚠️ **Tree Shaking**: Not fully configured for @noble/hashes

#### TypeScript 5.7 Security Patterns
- ✅ **Strict Mode**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled
- ✅ **Type Safety**: Zero `any` types in production code
- ✅ **Discriminated Unions**: Proper entity modeling
- ⚠️ **Need Branded Types**: For sensitive string types (passwords, keys)

#### Dexie Encryption Patterns[42][44][45]
- ⚠️ **NOT USING**: `dexie-encrypted` listed in dependencies but unused
- ⚠️ **Application-Level Only**: Encryption happens at app layer, not DB layer
- ✅ **Proper Schema**: Well-designed IndexedDB structure
- ❌ **Missing**: Transparent encryption middleware integration

#### Zustand Security Patterns[47][50]
- ✅ **Immutability**: State mutations follow predictable patterns
- ✅ **Persistence Partitioning**: Vault keys NOT persisted (correct)
- ⚠️ **Need Encryption**: Should use secure storage (AsyncStorage with encryption)
- ⚠️ **Client-Side Risks**: Too much sensitive data in client state

#### WebAuthn/Biometric Implementation[48][51]
- ✅ **Infrastructure Complete**: `webauthn.ts` fully implemented
- ❌ **NOT INTEGRATED**: No UI wiring, no credential storage
- ⚠️ **Passkey Support**: Need to align with latest Passkey standards
- ⚠️ **Platform Authenticator**: Correctly configured for device biometrics

---

## Enhancement Roadmap - 5 High-Value Use Cases

This roadmap consolidates all enhancement gaps from existing documentation into **five cross-cutting use cases** that deliver maximum business value. Each use case combines multiple technical improvements into a cohesive user-facing feature.

### Use Case 1: Master Password Session Lifecycle (CRITICAL - Week 1)
**User Story**: "As a vault owner, I can sign in, auto-lock on inactivity/tab hide, and unlock without losing decrypted data."

**Business Value**: Core trust guarantee; prevents data loss and security regressions.

**Technical Components**:
1. Fix vault key decryption in `UserRepositoryImpl.authenticateWithPassword`
2. Fix credential decryption in `CredentialRepositoryImpl.findById/findAll`
3. Implement `useAutoLock` hook with inactivity timer
4. Add tab visibility lock (document.visibilityState)
5. Create `UnlockPage` component for re-authentication
6. Implement secure clipboard clearing on lock

**Validation Requirements**:
- ✅ Integration test: `auth-flow.test.tsx` covering full lock/unlock cycle
- ✅ Unit tests for `useAutoLock` with fake timers
- ✅ Manual smoke test: Sign in → wait timeout → verify lock → re-auth → verify data intact
- ✅ IndexedDB inspection: No vault keys or decrypted data post-lock
- ✅ Lighthouse Security audit passing

**Files to Create/Modify**:
- `src/data/repositories/UserRepositoryImpl.ts` (fix decryption, ~30 lines)
- `src/data/repositories/CredentialRepositoryImpl.ts` (fix decryption, ~50 lines)
- `src/presentation/hooks/useAutoLock.ts` (new, ~200 lines)
- `src/presentation/pages/UnlockPage.tsx` (new, ~150 lines)
- `src/__tests__/integration/auth-flow.test.tsx` (expand, ~100 lines)

**Estimated Effort**: 2-3 days (Critical Path)

---

### Use Case 2: Secure Credential Lifecycle with Cards, TOTP & Autofill (Weeks 2-3)
**User Story**: "I can add/update/delete login, payment, and TOTP-enabled credentials and opt into browser autofill."

**Business Value**: Differentiates enterprise UX; ensures encryption paths match UI expectations; enables 2FA workflows.

**Technical Components**:
1. Build `AddCredentialPage` with full form validation
2. Build `EditCredentialPage` with delete confirmation
3. Integrate TOTP generator (RFC 6238 compliant)
4. Add `TotpDisplay` component with live countdown
5. Implement Credential Management API for autofill opt-in
6. Create `PasswordGeneratorDialog` with strength meter
7. Enhance dashboard with credential cards (responsive grid)
8. Add secure clipboard with auto-clear (30s default)

**Validation Requirements**:
- ✅ `credential-crud.test.tsx` covering all CRUD operations
- ✅ `totp-generation.test.ts` validating RFC 6238 compliance
- ✅ Repository unit tests for encryption/decryption of all credential types
- ✅ Mock Credential Management API for autofill testing
- ✅ UI smoke tests for form validation and error states
- ✅ Manual test: Create login with TOTP → verify 6-digit code changes every 30s

**Files to Create/Modify**:
- `src/presentation/pages/AddCredentialPage.tsx` (new, ~350 lines)
- `src/presentation/pages/EditCredentialPage.tsx` (new, ~350 lines)
- `src/presentation/components/PasswordGeneratorDialog.tsx` (new, ~300 lines)
- `src/core/auth/totp.ts` (new, ~200 lines)
- `src/presentation/components/TotpDisplay.tsx` (new, ~150 lines)
- `src/core/autofill/credentialManagementService.ts` (new, ~200 lines)
- `src/presentation/components/CredentialCard.tsx` (new, ~250 lines)
- `src/presentation/utils/clipboard.ts` (enhance, ~200 lines)
- `src/presentation/pages/DashboardPage.tsx` (expand, ~500 lines)

**Estimated Effort**: 8-10 days

---

### Use Case 3: Biometric Enrollment & Passwordless Unlock (Week 4)
**User Story**: "After enabling biometrics, I can unlock with Face ID/Fingerprint via WebAuthn-backed vault keys."

**Business Value**: Matches Android app feature parity; reduces sign-in friction; modern authentication UX.

**Technical Components**:
1. Wire `UserRepositoryImpl.registerBiometric()` to Settings page
2. Implement vault key wrapping with WebAuthn credential
3. Add biometric unlock option to `SigninPage` and `UnlockPage`
4. Store WebAuthn credentials in `user.webAuthnCredentials` array
5. Create fallback flow for biometric failure
6. Add device management UI (view/delete registered devices)
7. Implement challenge-response validation

**Validation Requirements**:
- ✅ Mocked WebAuthn unit tests (counter, challenge, vault-key wrapping)
- ✅ Integration spec: Register biometric → sign out → unlock with biometric
- ✅ Fallback state test: Biometric failure → fall back to password
- ✅ Multi-device test: Register on device A → verify can't unlock on device B
- ✅ Manual test with real device biometrics (Touch ID/Face ID)

**Files to Create/Modify**:
- `src/core/auth/biometricVaultKey.ts` (new, ~250 lines)
- `src/presentation/pages/SettingsPage.tsx` (add biometric section, ~100 lines)
- `src/presentation/components/BiometricEnrollment.tsx` (new, ~200 lines)
- `src/presentation/pages/SigninPage.tsx` (add biometric button, ~50 lines)
- `src/presentation/pages/UnlockPage.tsx` (add biometric button, ~50 lines)
- `src/data/repositories/UserRepositoryImpl.ts` (implement biometric methods, ~150 lines)

**Estimated Effort**: 5-7 days

---

### Use Case 4: Breach Detection Triage & Security Audit (Week 5)
**User Story**: "From Dashboard/Security Audit, I can scan via HIBP, see alerts, and drill into breach details."

**Business Value**: Converts security documentation into enforced behavior; required for compliance narratives; proactive threat mitigation.

**Technical Components**:
1. Implement `hibpService.ts` with k-anonymity password checking
2. Create `breachResultsRepository.ts` for storing scan results
3. Build `SecurityAuditPage` with weak password detection
4. Add `BreachAlertBanner` to dashboard for active breaches
5. Implement duplicate password detection
6. Add password age analysis (flag >90 days old)
7. Create security score calculation logic
8. Add feature flags for HIBP integration

**Validation Requirements**:
- ✅ Service tests for k-anonymity (never sends full password hash)
- ✅ Caching tests (don't hammer HIBP API)
- ✅ Rate limiting tests (respect HIBP API limits)
- ✅ UI integration test mocking HIBP responses
- ✅ Assert banner/modal behavior on breach detection
- ✅ Manual test: Use known-breached password → verify alert

**Files to Create/Modify**:
- `src/core/breach/hibpService.ts` (new, ~300 lines)
- `src/data/repositories/breachResultsRepository.ts` (new, ~150 lines)
- `src/presentation/pages/SecurityAuditPage.tsx` (new, ~400 lines)
- `src/presentation/components/BreachAlertBanner.tsx` (new, ~120 lines)
- `src/presentation/components/SecurityScoreCard.tsx` (new, ~150 lines)
- `.env` (add HIBP feature flags)

**Estimated Effort**: 5-7 days

---

### Use Case 5: Encrypted Import/Export & Disaster Recovery (Week 6)
**User Story**: "I can export my vault to a password-protected `.tvault` file and re-import/merge safely."

**Business Value**: Closes high-risk plaintext export gap; enables disaster recovery; supports vault migration.

**Technical Components**:
1. Create `exportEncryption.ts` with AES-256-GCM encryption
2. Build `ExportDialog` with password protection (min 12 chars)
3. Build `ImportDialog` with decrypt + merge/replace modes
4. Implement duplicate detection (by title + username)
5. Add progress indicators for large vaults
6. Create `.tvault` file format specification
7. Add export/import to Settings page

**Validation Requirements**:
- ✅ Crypto roundtrip test (export → import → verify data identical)
- ✅ Wrong password test (verify error, no data leak)
- ✅ Duplicate handling test (merge mode preserves both, replace mode overwrites)
- ✅ Large vault test (100+ credentials with progress tracking)
- ✅ Manual test: Export → wipe IndexedDB → import → verify all data restored

**Files to Create/Modify**:
- `src/core/crypto/exportEncryption.ts` (new, ~250 lines)
- `src/presentation/components/ExportDialog.tsx` (new, ~300 lines)
- `src/presentation/components/ImportDialog.tsx` (new, ~400 lines)
- `src/presentation/pages/SettingsPage.tsx` (add export/import buttons, ~50 lines)
- `src/data/repositories/CredentialRepositoryImpl.ts` (enhance import/export, ~100 lines)

**Estimated Effort**: 5-7 days

---

## Detailed Technical Roadmap by Phase

### Phase 0: Critical Bug Fixes (MUST COMPLETE FIRST)

#### 0.1 Fix Vault Key Decryption (BLOCKING)
**Current Issue**: Vault key derived but never decrypted from encrypted storage.

**Root Cause**: `UserRepositoryImpl.ts:92` derives a key from password+salt, but the actual vault key (stored encrypted in `user.encryptedVaultKey`) is never decrypted.

**Solution**:
async authenticateWithPassword(email: string, password: string): Promise<AuthSession> {
  const user = await userDataSource.findByEmail(email);
  if (!user) throw new Error('User not found');

  // Step 1: Derive temporary key from password (CURRENT)
  const derivedKey = await deriveKeyFromPassword(password, hexToBytes(user.salt));

  // Step 2: Decrypt the actual vault key (MISSING)
  const encryptedVaultKey = JSON.parse(user.encryptedVaultKey);
  const actualVaultKey = await decrypt(encryptedVaultKey, derivedKey);

  // Step 3: Import as CryptoKey for use (MISSING)
  const vaultKey = await importVaultKey(actualVaultKey);

  return {
    user,
    vaultKey, // Now contains the actual decrypted vault key
    expiresAt: Date.now() + 3600000
  };
}

**Validation**: Create credential → sign out → sign in → verify password displays correctly

---

#### 0.2 Fix Credential Password Decryption (BLOCKING)
**Current Issue**: `findById()` and `findAll()` ignore `vaultKey` parameter and return encrypted data.

**Root Cause**: No decryption logic implemented in read methods.

**Solution**:
async findById(id: string, vaultKey: CryptoKey): Promise<Credential> {
  const stored = await credentialsTable.get(id);
  if (!stored) throw new Error('Credential not found');

  return this.decryptCredential(stored, vaultKey);
}

private async decryptCredential(
  stored: StoredCredential,
  vaultKey: CryptoKey
): Promise<Credential> {
  return {
    ...stored,
    password: stored.password 
      ? await decrypt(JSON.parse(stored.password), vaultKey) 
      : null,
    notes: stored.notes 
      ? await decrypt(JSON.parse(stored.notes), vaultKey) 
      : null,
    totpSecret: stored.totpSecret 
      ? await decrypt(JSON.parse(stored.totpSecret), vaultKey) 
      : null,
    cardNumber: stored.cardNumber 
      ? await decrypt(JSON.parse(stored.cardNumber), vaultKey) 
      : null,
    cardCVV: stored.cardCVV 
      ? await decrypt(JSON.parse(stored.cardCVV), vaultKey) 
      : null,
  };
}

**Validation**: Add credential → refresh page → verify password displayed correctly (not encrypted gibberish)

---

### Phase 1: Core Credential Management (Weeks 2-3)

#### 1.1 Add/Edit Credential Forms with OCR Capture
**Goal**: Complete CRUD UI with innovative camera-based credential capture

**New Innovation**: Tesseract.js Integration for OCR-based credential entry

**Components**:
1. **AddCredentialPage** - Full form with validation
   - Title, username, password, URL, notes, category, tags
   - Password strength indicator
   - Generate password button
   - TOTP secret field (optional)
   - **NEW**: Camera capture button for OCR text extraction

2. **OCR Credential Capture** (New Feature)
// src/presentation/components/OcrCredentialCapture.tsx
import Tesseract from 'tesseract.js';

const OcrCredentialCapture: React.FC = () => {
  const capture ImageAndExtract = async (imageData: string) => {
    const { data: { text } } = await Tesseract.recognize(
      imageData,
      'eng',
      { logger: m => console.log(m) }
    );

    // Smart parsing: Extract username/password patterns
    const patterns = {
      email: /[\w.-]+@[\w.-]+\.\w+/,
      url: /https?:\/\/[\w.-]+/,
      username: /(?:user(?:name)?|login|email)[\s:]+(\S+)/i,
      password: /(?:pass(?:word)?|pwd)[\s:]+(\S+)/i
    };

    return {
      url: text.match(patterns.url)?.[0] || '',
      username: text.match(patterns.username)?.[1] || text.match(patterns.email)?.[0] || '',
      password: text.match(patterns.password)?.[1] || ''
    };
  };

  return (
    <Box>
      <input type="file" accept="image/*" capture="environment" />
      <Typography>Point camera at credential document</Typography>
    </Box>
  );
};

**Validation**: 
- Take photo of test credential → verify OCR extraction accuracy
- Test with various document types (screenshots, PDFs, photos)

---

#### 1.2 Dashboard Enhancement with Real Data
**Goal**: Transform static dashboard into functional credential manager

**Components**:
1. Load credentials from repository on mount
2. Responsive card grid (1/2/3 columns)
3. Credential card with:
   - Copy username/password buttons
   - Edit/delete actions
   - Category badge
   - Favorite star
   - TOTP display (if configured)
   - Security score indicator

4. Search/filter implementation:
   - Real-time search (debounced 300ms)
   - Category filters
   - Favorites toggle
   - Sort options (A-Z, recent, favorites first)

**Performance Optimization**:
// Memoize filtered credentials
const filteredCredentials = useMemo(() => {
  let results = credentials;
  
  if (searchQuery) {
    results = results.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  if (categoryFilter) {
    results = results.filter(c => c.category === categoryFilter);
  }
  
  if (favoritesOnly) {
    results = results.filter(c => c.isFavorite);
  }
  
  return results;
}, [credentials, searchQuery, categoryFilter, favoritesOnly]);

---

### Phase 2: Advanced Security (Weeks 4-5)

#### 2.1 TOTP/2FA Generator
**RFC 6238 Compliant Implementation**:

// src/core/auth/totp.ts
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

**UI Component**:
const TotpDisplay: React.FC<{ secret: string }> = ({ secret }) => {
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const updateCode = () => {
      setCode(generateTOTP(secret));
      setTimeLeft(30 - (Math.floor(Date.now() / 1000) % 30));
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  return (
    <Box>
      <Typography variant="h4" fontFamily="monospace">
        {code.slice(0, 3)} {code.slice(3)}
      </Typography>
      <CircularProgress 
        variant="determinate" 
        value={(timeLeft / 30) * 100} 
      />
    </Box>
  );
};

---

#### 2.2 Auto-Lock with Tab Visibility
**Inactivity Detection**:

// src/presentation/hooks/useAutoLock.ts
export function useAutoLock(timeoutMinutes: number) {
  const { lockVault } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      lockVault();
      navigate('/unlock');
    }, timeoutMinutes * 60 * 1000);
  }, [timeoutMinutes, lockVault]);

  useEffect(() => {
    // Reset timer on any user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Lock immediately when tab hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockVault();
        navigate('/unlock');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetTimer(); // Start initial timer

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimer, lockVault]);
}

---

### Phase 3: Settings & UX (Week 6)

#### 3.1 Comprehensive Settings Page
**Sections**:

1. **Security Settings**:
   - Session timeout (1, 5, 15, 30 min, Never)
   - Clipboard auto-clear (15, 30, 60, 120s, Never)
   - Require password on wake
   - Biometric authentication toggle

2. **Display Settings**:
   - Theme (Light, Dark, System)
   - Show password strength indicators
   - Credential card density (Comfortable, Compact)

3. **Password Generator Defaults**:
   - Default length (slider: 12-32)
   - Character type toggles
   - Exclude ambiguous characters

4. **Data Management**:
   - Export vault (encrypted)
   - Import vault (with merge/replace options)
   - Clear all data (double confirmation)

5. **Account**:
   - Change master password
   - Last login timestamp
   - Account created date
   - Biometric devices management

---

#### 3.2 Change Master Password with Re-encryption
**Process Flow**:

async changeMasterPassword(
  currentPassword: string,
  newPassword: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // 1. Verify current password
  const user = await userDataSource.findByEmail(currentUser.email);
  const isValid = await verifyPassword(currentPassword, user.hashedMasterPassword);
  if (!isValid) throw new Error('Current password incorrect');

  // 2. Derive new vault key
  const newSalt = randomBytes(32);
  const newVaultKey = await deriveKeyFromPassword(newPassword, newSalt);

  // 3. Get current vault key
  const currentVaultKey = authStore.getState().vaultKey;

  // 4. Re-encrypt all credentials
  const allCredentials = await credentialRepository.findAll(currentVaultKey);
  
  for (let i = 0; i < allCredentials.length; i++) {
    await credentialRepository.delete(allCredentials[i].id);
    await credentialRepository.save(allCredentials[i], newVaultKey);
    onProgress?.(i + 1, allCredentials.length);
  }

  // 5. Update user record
  const newHashedPassword = await hashPassword(newPassword);
  const newEncryptedVaultKey = await encryptVaultKey(newVaultKey);
  
  await userDataSource.update({
    ...user,
    hashedMasterPassword: newHashedPassword,
    encryptedVaultKey: JSON.stringify(newEncryptedVaultKey),
    salt: bytesToHex(newSalt)
  });

  // 6. Force logout
  authStore.getState().logout();
  navigate('/signin');
}

---

### Phase 4: Testing & Quality (Weeks 7-8)

#### 4.1 Unit Test Suite
**Coverage Targets**:
- Encryption/Decryption: 100%
- Password hashing: 100%
- TOTP generation: 100%
- Repository methods: 90%
- Utility functions: 90%

**Example Test**:
describe('Encryption', () => {
  it('should encrypt and decrypt correctly', async () => {
    const plaintext = 'sensitive data';
    const key = await deriveKeyFromPassword('test-password', new Uint8Array(32));
    
    const encrypted = await encrypt(plaintext, key);
    const decrypted = await decrypt(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', async () => {
    const plaintext = 'test';
    const key = await deriveKeyFromPassword('test-password', new Uint8Array(32));
    
    const encrypted1 = await encrypt(plaintext, key);
    const encrypted2 = await encrypt(plaintext, key);

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext); // Unique IVs
  });
});

---

#### 4.2 Integration Test Suite
**Key Flows**:
1. Complete auth flow (signup → add → signout → signin → read)
2. CRUD operations (create → update → delete → verify)
3. Password generator (generate → use → save → verify)
4. Master password change (change → re-auth → verify)
5. Import/export (export → wipe → import → verify)

---

#### 4.3 Security Audit
**OWASP Mobile Top 10 2025 Checklist**:
- ✅ M1: Improper Credentials Usage - Secure storage verified
- ✅ M2: Supply Chain Security - Dependencies audited
- ✅ M3: Insecure Authentication - WebAuthn implemented
- ✅ M4: Insufficient Input Validation - XSS prevention verified
- ✅ M5: Insecure Communication - HTTPS enforced
- ✅ M6: Inadequate Privacy Controls - Zero telemetry
- ✅ M7: Insufficient Binary Protection - CSP headers enforced
- ✅ M8: Security Misconfiguration - Hardening verified
- ✅ M9: Insecure Data Storage - Encrypted at rest
- ✅ M10: Insufficient Cryptography - OWASP 2025 compliant

---

### Phase 5: Production Readiness (Week 9-10)

#### 5.1 Performance Optimization
**Vite Bundle Optimization**:

// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'security-vendor': ['@noble/hashes'],
          'storage-vendor': ['dexie'],
          'crypto-vendor': ['@simplewebauthn/browser']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['tesseract.js'] // Large library, load on demand
  }
});

**Lazy Loading**:
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SecurityAuditPage = lazy(() => import('./pages/SecurityAuditPage'));

---

#### 5.2 PWA Enhancements
**Install Prompt**:
useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e);
  };

  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);

const handleInstall = async () => {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('PWA installed');
  }
  
  setDeferredPrompt(null);
};

**Manifest Shortcuts**:
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

---

## Validation Questions by Use Case

### Use Case 1: Session Lifecycle
**Q1**: Is the vault key decryption working end-to-end?
- ✅ Sign in → verify vault key in authStore is CryptoKey (not Uint8Array)
- ✅ Add credential → verify encryption uses correct vault key
- ✅ Sign out/in → verify credentials decrypt correctly

**Q2**: Does auto-lock preserve data integrity?
- ✅ Set 1-minute timeout → wait → verify locks
- ✅ After lock, verify no vault key in memory
- ✅ Unlock → verify credentials load correctly
- ✅ Tab switch → verify immediate lock

**Q3**: Is clipboard cleared on lock?
- ✅ Copy password → lock vault → verify clipboard empty
- ✅ Verify clipboard auto-clears after 30s

---

### Use Case 2: Credential Operations
**Q4**: Does TOTP generation match Google Authenticator?
- ✅ Use test secret: `JBSWY3DPEHPK3PXP`
- ✅ Compare 6-digit code with Google Authenticator
- ✅ Verify code changes every 30 seconds
- ✅ Test multiple secrets

**Q5**: Does OCR credential capture work accurately?
- ✅ Test with screenshot of login credentials
- ✅ Test with photo of paper document
- ✅ Verify username/password extraction
- ✅ Test error handling for unclear images

**Q6**: Are all credential types encrypted correctly?
- ✅ Login → verify password encrypted
- ✅ Payment card → verify cardNumber + CVV encrypted
- ✅ TOTP → verify secret encrypted
- ✅ Secure note → verify notes encrypted
- ✅ Check IndexedDB: no plaintext sensitive data

---

### Use Case 3: Biometric Authentication
**Q7**: Does WebAuthn registration work cross-browser?
- ✅ Chrome: Touch ID registration on macOS
- ✅ Safari: Face ID registration on iOS
- ✅ Edge: Windows Hello registration
- ✅ Firefox: Platform authenticator support

**Q8**: Is vault key securely wrapped with WebAuthn?
- ✅ Register biometric → verify vault key encrypted with credential
- ✅ Sign out → biometric unlock → verify vault key unwrapped correctly
- ✅ Attempt unlock on different device → verify fails

**Q9**: Does fallback to password work?
- ✅ Biometric failure → verify password option appears
- ✅ Cancel biometric prompt → verify password form shows
- ✅ Wrong password after biometric fail → verify error

---

### Use Case 4: Breach Detection
**Q10**: Does HIBP integration preserve privacy?
- ✅ Use k-anonymity (send only first 5 chars of SHA-1 hash)
- ✅ Verify full hash never sent to HIBP
- ✅ Check network tab: only prefix sent

**Q11**: Are weak passwords detected correctly?
- ✅ Add credential with password `password123` → verify flagged
- ✅ Add credential with `P@ssw0rd!2024!` → verify flagged as common
- ✅ Add credential with `xK9$mL#pQ2@vN8` → verify marked strong

**Q12**: Does duplicate password detection work?
- ✅ Add 2 credentials with same password → verify alert
- ✅ Security audit shows duplicate count
- ✅ Click on duplicate → shows affected credentials

---

### Use Case 5: Import/Export
**Q13**: Is export encrypted properly?
- ✅ Export with password → verify file is binary (not JSON)
- ✅ Attempt to open .tvault in text editor → verify gibberish
- ✅ Verify AES-256-GCM used for encryption

**Q14**: Does import handle duplicates correctly?
- ✅ Export vault → add new credential → import (merge mode) → verify both exist
- ✅ Export vault → modify credential → import (replace mode) → verify old version
- ✅ Import with wrong password → verify error, no data modified

**Q15**: Can we recover from complete data loss?
- ✅ Export vault → clear IndexedDB → import → verify all credentials restored
- ✅ Verify encryption still works post-import
- ✅ Verify TOTP codes match pre-export

---

## Technology Stack Best Practices Alignment

### React 19 Optimization Checklist
- [ ] Implement React Compiler for automatic memoization
- [ ] Use Suspense for async route loading
- [ ] Progressive enhancement for critical features
- [ ] Optimize re-renders with useMemo/useCallback
- [ ] Code splitting for large components (PasswordGenerator, SecurityAudit)

### Vite 6 Build Optimization
- [ ] Configure `manualChunks` for vendor splitting
- [ ] Enable WebP image generation with fallbacks
- [ ] Tree-shake unused @noble/hashes exports
- [ ] Minify service worker with Terser
- [ ] Add Brotli compression for static assets

### TypeScript 5.7 Advanced Patterns
- [ ] Branded types for sensitive strings (`type Password = string & { __brand: 'password' }`)
- [ ] Exhaustive switch checks with `satisfies` operator
- [ ] Const type parameters for literal type inference
- [ ] Template literal types for route definitions
- [ ] Discriminated unions for credential types

### Dexie Security Hardening
- [ ] Enable `dexie-encrypted` middleware for transparent encryption
- [ ] Implement database versioning for schema migrations
- [ ] Add indexes on commonly-queried fields (category, isFavorite)
- [ ] Set up database size limits (quota management)
- [ ] Implement periodic database cleanup (old sessions)

### Zustand State Security
- [ ] Never persist vault keys (already correct)
- [ ] Encrypt persisted state with AsyncStorage encryption wrapper
- [ ] Clear sensitive state on logout (credentials, vault key)
- [ ] Use immer middleware for immutable updates
- [ ] Implement state hydration with validation

### WebAuthn Best Practices
- [ ] Use platform authenticators only (no external devices)
- [ ] Require user verification (UV) flag
- [ ] Store challenge server-side (or generate cryptographically)
- [ ] Implement credential backup (multiple devices)
- [ ] Support credential management (view/delete devices)

---

## Production Deployment Checklist

### Pre-Launch Requirements
- [ ] All critical bugs fixed (Phase 0 complete)
- [ ] Core features complete (Phases 1-3 done)
- [ ] Test coverage >85% overall
- [ ] Integration tests passing
- [ ] Security audit passed (OWASP checklist complete)
- [ ] Lighthouse scores >90 (Performance, Accessibility, Best Practices, SEO)
- [ ] PWA audit score: 100
- [ ] No critical/high npm vulnerabilities
- [ ] Documentation complete (README, USER_GUIDE, SECURITY)
- [ ] Privacy policy updated
- [ ] Terms of service drafted

### Deployment Steps
1. **Build Verification**:
   npm run type-check  # 0 errors
   npm run lint        # 0 warnings
   npm run test        # All pass
   npm run build       # Success

2. **Bundle Analysis**:
   npm run analyze:bundle
   # Verify total <500KB
   # Check vendor chunks reasonable size

3. **Lighthouse Audit**:
   npm run build
   npm run preview
   npm run lighthouse
   # Performance >90
   # Accessibility >90
   # Best Practices >90
   # SEO >90
   # PWA: 100

4. **Security Scan**:
   npm audit --audit-level=moderate
   # 0 critical/high vulnerabilities

5. **Deploy to Vercel**:
   vercel --prod
   # Test PWA installability
   # Test offline mode
   # Test service worker updates

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 0: Critical Fixes | 2-3 days | Vault key decryption, credential decryption |
| Phase 1: Core CRUD | 8-10 days | Add/Edit forms, Dashboard, Search/Filter, OCR capture |
| Phase 2: Advanced Security | 10-12 days | TOTP, Auto-lock, Password generator, Clipboard security |
| Phase 3: Settings & UX | 8-10 days | Settings page, Master password change, Import/Export |
| Phase 4: Biometrics | 5-7 days | WebAuthn integration, Biometric unlock |
| Phase 5: Breach Detection | 5-7 days | HIBP integration, Security audit page |
| Phase 6: Testing | 10-12 days | Unit tests, Integration tests, Security audit |
| Phase 7: Production | 5-7 days | Performance optimization, PWA features, Deployment |

**Total Estimated Time**: 53-68 days (~10-14 weeks)

**Recommended Sprint Structure** (2-week sprints):
- Sprint 1: Phase 0 + Start Phase 1
- Sprint 2: Complete Phase 1
- Sprint 3: Phase 2
- Sprint 4: Phase 3 + Phase 4
- Sprint 5: Phase 5 + Start Phase 6
- Sprint 6: Complete Phase 6 + Phase 7

---

## Success Metrics

### Technical Metrics
- [ ] Lighthouse Performance: >90
- [ ] Lighthouse Accessibility: >90
- [ ] Lighthouse Best Practices: >90
- [ ] Lighthouse SEO: >90
- [ ] PWA Score: 100
- [ ] Test Coverage: >85%
- [ ] Bundle Size: <500KB total
- [ ] Time to Interactive: <2s
- [ ] First Contentful Paint: <1s

### Security Metrics
- [ ] OWASP Mobile Top 10 2025: All 10 addressed
- [ ] Zero critical/high npm vulnerabilities
- [ ] CSP headers enforced
- [ ] No sensitive data in localStorage
- [ ] Vault keys never persisted
- [ ] All credentials encrypted at rest
- [ ] WebAuthn properly implemented

### User Experience Metrics
- [ ] All core features functional
- [ ] Zero blocking bugs
- [ ] Offline mode works
- [ ] Install prompt works
- [ ] Biometric unlock works (iOS/Android)
- [ ] Auto-lock prevents data leaks
- [ ] Import/export preserves data integrity

---

## Risk Mitigation

### Technical Risks
1. **WebAuthn Browser Compatibility**:
   - Mitigation: Implement feature detection, provide password fallback
   - Test on Chrome, Safari, Edge, Firefox

2. **IndexedDB Quota Limits**:
   - Mitigation: Implement quota monitoring, warn at 80% full
   - Provide export option before hitting limits

3. **Service Worker Update Failures**:
   - Mitigation: Implement robust update mechanism with fallback
   - Show update notification to users

4. **HIBP API Rate Limiting**:
   - Mitigation: Implement client-side caching (24h TTL)
   - Batch requests, throttle scans

### Security Risks
1. **Vault Key Exposure in Memory**:
   - Mitigation: Clear on lock, implement auto-lock
   - Use CryptoKey (non-extractable) where possible

2. **Clipboard Sniffing**:
   - Mitigation: Auto-clear after 30s, clear on lock
   - Warn users about clipboard risks

3. **Export File Interception**:
   - Mitigation: Encrypt exports with strong password
   - Warn users to store export password securely

---

## Conclusion

TrustVault PWA demonstrates **excellent architectural foundation** with production-ready cryptography and modern tech stack alignment. The roadmap addresses **critical blocking bugs first**, then systematically delivers high-value user features through **five focused use cases**.

**Next Immediate Actions**:
1. Fix vault key decryption (Phase 0.1)
2. Fix credential decryption (Phase 0.2)
3. Validate end-to-end encryption flow
4. Begin Use Case 1 implementation (Session Lifecycle)

By following this structured roadmap, TrustVault PWA will achieve **production readiness in 10-14 weeks** with comprehensive test coverage, OWASP compliance, and feature parity with native password managers.

---

## References

[1] React 19 Features & Performance - https://www.ijirset.com/upload/2025/february/97_Comparative.pdf  
[20] React PWA Best Practices - https://www.f22labs.com/blogs/how-to-build-progressive-web-apps-pwas-with-react/  
[24] React & Next.js 2025 Best Practices - https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices  
[25] Vite Optimization Guide - https://dev.to/yogeshgalav7/how-to-optimize-vite-app-i89  
[28] Vite Performance Best Practices - https://vite.dev/guide/performance  
[42] Dexie Encrypted Middleware - https://github.com/dfahlander/dexie-encrypted  
[44] Dexie Best Practices - https://dexie.org/docs/Tutorial/Best-Practices  
[45] Dexie Encryption Advice - https://github.com/dfahlander/Dexie.js/issues/890  
[47] Zustand React Native Security - https://reactnativeexpert.com/blog/mastering-zustand-in-react-native/  
[48] Biometric Authentication Passkeys - https://progressier.com/pwa-capabilities/biometric-authentication-with-passkeys  
[50] Zustand State Management Patterns - https://techradar.aoe.com/methods-and-patterns/state-management-pattern/  
[51] WebAuthn Angular Integration - https://dev.to/this-is-angular/integrate-fingerprint-and-face-id-authentication-in-your-angular-app-using-webauthn-a-step-by-ste