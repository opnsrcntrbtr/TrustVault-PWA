# Module Contracts — TrustVault PWA

This document defines the **public API** of every module. When writing code, use only what's listed here.

---

## Core Layer (`src/core/`)

### Authentication (`src/core/auth/`)

**What it does:** WebAuthn biometric registration, TOTP/2FA, master password hashing, backup codes.

**Key modules:**
- `webauthn.ts` — WebAuthn/biometric operations
- `biometricVaultKey.ts` — PRF-based vault key wrapping
- `totp.ts` — TOTP/2FA code generation & verification
- `backupCodes.ts` — Backup code management
- `biometricMigration.ts` — DB migration helpers
- `usernameMigration.ts` — Username derivation
- `usernameValidation.ts` — Username validation

---

### Breach Detection (`src/core/breach/`)

**What it does:** Have I Been Pwned (HIBP) integration, k-anonymity password checking, breach caching.

**Key files:**
- `hibpService.ts` — HIBP API client
- `breachPrefixStore.ts` — Offline breach prefix cache
- `rangeCache.ts` — Cache management
- `unlockBreachRefresh.ts` — Periodic sync
- `breachTypes.ts` — Type definitions

---

### Cryptography (`src/core/crypto/`)

**What it does:** AES-256-GCM encryption, Scrypt hashing, PBKDF2 key derivation.

**Key files:**
- `encryption.ts` — Encrypt/decrypt operations
- `password.ts` — Master password hashing & verification
- `exportEncryption.ts` — Import/export encryption

---

### OCR (`src/core/ocr/`)

**What it does:** Camera capture, Tesseract OCR, credential text parsing.

**Key files:**
- `cameraCapture.ts` — Camera access & frame capture
- `tesseractService.ts` — OCR worker management
- `credentialParser.ts` — Text parsing

---

### Autofill (`src/core/autofill/`)

**What it does:** Credential matching, domain validation, extension bridge.

**Key files:**
- `credentialManagementService.ts` — Matching & domain validation
- `autofillSettings.ts` — Per-origin allow-list
- `extensionBridge.ts` — Chrome extension communication

---

### Utilities (`src/core/utils/`)

**What it does:** Base64 encoding/decoding helpers.

**Key files:**
- `base64.ts` — ArrayBuffer ↔ Base64 conversions

---

## Domain Layer (`src/domain/`)

### Entities (`src/domain/entities/`)

Type definitions for business objects:
- `User.ts` — User, AuthSession, SecuritySettings
- `Credential.ts` — Credential, CredentialCategory, BackupCode, BiometricCredential
- `VaultProfile.ts` — VaultProfile, VaultProfileInput

### Repositories (`src/domain/repositories/`)

Interface contracts (no implementation):
- `IUserRepository.ts` — User CRUD interface
- `ICredentialRepository.ts` — Credential CRUD interface
- `IProfileRepository.ts` — Profile CRUD interface

---

## Data Layer (`src/data/`)

### Repositories (`src/data/repositories/`)

**Implementations of domain repository interfaces:**
- `UserRepositoryImpl.ts` — User CRUD, authentication
- `CredentialRepositoryImpl.ts` — Credential CRUD, encryption
- `ProfileRepositoryImpl.ts` — Profile CRUD
- `breachResultsRepository.ts` — Breach result caching
- `importValidation.ts` — Import payload validation
- `metadataSealing.ts` — Metadata encryption (S5)
- `profileMigration.ts` — Database migrations

### Storage (`src/data/storage/`)

**IndexedDB management via Dexie:**
- `database.ts` — Schema, migrations, initialization
- `debugUtils.ts` — Debug helpers

---

## Presentation Layer (`src/presentation/`)

### Pages (`src/presentation/pages/`)

**Page-level components:**
- `SignInPage.tsx` — Login
- `SignUpPage.tsx` — Registration
- `DashboardPage.tsx` — Credential list view
- `AddCredentialPage.tsx` — Create/edit credential
- `SettingsPage.tsx` — User settings
- `UnlockPage.tsx` — Session unlock

### Store (`src/presentation/store/`)

**Zustand global state:**
- `authStore.ts` — Authentication state & actions
- `credentialStore.ts` — Credential list & filtering
- `profileStore.ts` — Multi-vault profile switching
- `themeStore.ts` — Dark/light mode

### Components (`src/presentation/components/`)

**Reusable UI components:**
- Credential management: `CredentialCard`, `AddCredentialDialog`, `CredentialDetailsDialog`
- Security: `BreachAlertBanner`, `BiometricSetupDialog`, `PasswordGeneratorDialog`
- Utility: `SearchBar`, `FilterChips`, `SortDropdown`, `ErrorBoundary`, `OfflineIndicator`, `ThemeToggle`
- Dialogs: `ExportDialog`, `ImportDialog`

### Hooks (`src/presentation/` — various locations)

**Custom React hooks:**
- `useAutoLock` — Session timeout management
- `usePasswordGenerator` — Password generation UI
- `useDriverTour` — Onboarding tour

---

## Test Fixtures (`src/__tests__/fixtures/`)

**Mock data for testing:**
- `mockCredentials.ts` — Mock credential objects
- `mockUsers.ts` — Mock user objects
- `index.ts` — Fixture exports

---

## Import Direction (Enforced)

```
presentation → data → domain → core
    ↓           ↓        ↓
(import)   (import)  (import)  (no imports)
```

**Valid imports:**
- ✅ `presentation/store/authStore.ts` imports `UserRepositoryImpl` from `data/repositories/`
- ✅ `data/repositories/UserRepositoryImpl.ts` imports `User` from `domain/entities/`
- ✅ `data/repositories/CredentialRepositoryImpl.ts` imports `encrypt()` from `core/crypto/`

**Invalid imports:**
- ❌ `core/` imports from `data/`, `domain/`, or `presentation/`
- ❌ `domain/` imports from `data/` or `presentation/`
- ❌ `data/` imports from `presentation/`

---

## Development Workflow

1. **Identify the layer** your change touches (core/data/domain/presentation)
2. **Check this document** for available APIs
3. **Follow the dependency direction** — never import "upward" the stack
4. **Read module README** for design patterns (in each module directory)
5. **Write tests** colocated with code (`.test.ts` / `.test.tsx`)
6. **Verify type-check** — `npm run type-check`

---

## Rationale

- **Core is dependency-free** — enables offline, reduces coupling
- **Domain defines contracts** — repositories are abstracted, implementations pluggable
- **Data implements domain** — encryption, caching, DB details isolated
- **Presentation consumes data** — React components stay focused on UI, not business logic
