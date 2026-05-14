# Graph Report - .  (2026-05-14)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1027 nodes · 1774 edges · 87 communities (68 shown, 19 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.88)
- Token cost: 12,500 input · 3,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Vault Key Encryption & Crypto Core|Vault Key Encryption & Crypto Core]]
- [[_COMMUNITY_WebAuthn Authentication|WebAuthn Authentication]]
- [[_COMMUNITY_Breach Detection (HIBP)|Breach Detection (HIBP)]]
- [[_COMMUNITY_PWA Icons & Branding|PWA Icons & Branding]]
- [[_COMMUNITY_Service Worker Cache Layer|Service Worker Cache Layer]]
- [[_COMMUNITY_Changelog & Passphrase Generator|Changelog & Passphrase Generator]]
- [[_COMMUNITY_Clipboard Security & Favorites|Clipboard Security & Favorites]]
- [[_COMMUNITY_UI Form Elements|UI Form Elements]]
- [[_COMMUNITY_TOTP Edge Cases|TOTP Edge Cases]]
- [[_COMMUNITY_Service Worker Strategy|Service Worker Strategy]]
- [[_COMMUNITY_Integration Tests|Integration Tests]]
- [[_COMMUNITY_Vendor  Minified Code|Vendor / Minified Code]]
- [[_COMMUNITY_Browser Autofill Extension|Browser Autofill Extension]]
- [[_COMMUNITY_Password Parsing & Preferences|Password Parsing & Preferences]]
- [[_COMMUNITY_Security Documentation Hub|Security Documentation Hub]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `useAuthStore` - 22 edges
2. `Password Generator` - 21 edges
3. `EditCredentialPage` - 19 edges
4. `encrypt()` - 18 edges
5. `AddCredentialPage` - 18 edges
6. `DashboardPage` - 17 edges
7. `decrypt()` - 16 edges
8. `StrategyHandler` - 15 edges
9. `CredentialCard` - 15 edges
10. `PrecacheController` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Zero-Knowledge Architecture Validation` --semantically_similar_to--> `Session and Memory Security Design`  [INFERRED] [semantically similar]
  TEST_STATUS.md → SECURITY_AUDIT_CHECKLIST.md
- `Password Generator` --calls--> `getDefaultPassphraseOptions()`  [EXTRACTED]
  USER_GUIDE.md → src/features/vault/generator/passphraseGenerator.ts
- `TrustVault Test Automation Summary` --semantically_similar_to--> `TrustVault Comprehensive Test Analysis Report`  [INFERRED] [semantically similar]
  TEST_SUMMARY.md → TEST_ANALYSIS_REPORT.md
- `Test Validation Plan & Execution` --semantically_similar_to--> `Test Validation Summary Phase 0 to 2.4`  [INFERRED] [semantically similar]
  TEST_VALIDATION_PLAN.md → TEST_VALIDATION.md
- `Biometric Authentication Setup Guide` --semantically_similar_to--> `Phase 4.1 Biometric Authentication Summary`  [INFERRED] [semantically similar]
  BIOMETRIC_SETUP_GUIDE.md → PHASE_4.1_BIOMETRIC_AUTH.md

## Hyperedges (group relationships)
- **WebAuthn Dead Code Fix — Cross-Document Security Event** — changelog_v101, security_audit_report_webauthn_verification, test_status_webauthn_security_fix [EXTRACTED 1.00]
- **Biometric Vault Key Encryption Chain (PBKDF2 + WebAuthn + UserRepo)** — phase_41_pbkdf2_biometric_vault_key, changelog_biometric_vault_key, phase_41_user_repository [EXTRACTED 1.00]
- **OWASP M10 Cryptography Compliance (Scrypt + PBKDF2 + AES-GCM)** — security_audit_report_scrypt, security_audit_report_pbkdf2, security_audit_report_aes_gcm [EXTRACTED 1.00]

## Communities (87 total, 19 thin omitted)

### Community 0 - "Vault Key Encryption & Crypto Core"
Cohesion: 0.05
Nodes (68): decryptVaultKeyFromBiometric(), deriveDeviceKey(), encryptVaultKeyForBiometric(), retrieveBiometricVaultKey(), storeBiometricVaultKey(), hashPassword(), biometricVaultKey.ts, arrayBufferToBase64() (+60 more)

### Community 1 - "WebAuthn Authentication"
Cohesion: 0.05
Nodes (47): authenticateBiometric(), BiometricCredential, generateChallenge(), getAuthenticatorInfo(), getDeviceName(), isBiometricAvailable(), isWebAuthnSupported(), registerBiometric() (+39 more)

### Community 2 - "Breach Detection (HIBP)"
Cohesion: 0.06
Nodes (47): BreachCheckOptions, BreachCheckResult, BreachData, BreachSeverity, HibpError, RateLimitState, breachCache, checkEmailBreach() (+39 more)

### Community 3 - "PWA Icons & Branding"
Cohesion: 0.06
Nodes (55): Apple Touch Icon (180x180), Dark Navy Background Circle, Brand Navy #1a1a2e, Brand Teal #16c79a, Browser Tab Icon, Center Pivot Dot, Circular Safe Area Indicator, Circular Safe Zone Border Indicator (+47 more)

### Community 4 - "Service Worker Cache Layer"
Cohesion: 0.09
Nodes (49): additionalURLs, cachedMethods, cacheDonePromiseForTransaction(), cacheMatchIgnoreParams(), _cacheNameDetails, cacheNames, cacheWillUpdate(), canConstructResponseFromBodyStream() (+41 more)

### Community 5 - "Changelog & Passphrase Generator"
Cohesion: 0.08
Nodes (35): capitalizeWord(), DICEWARE_WORDS, generateMemorablePassphrase(), generatePassphrase(), getDefaultPassphraseOptions(), getRandomSeparator(), getRandomWord(), insertRandomDigits() (+27 more)

### Community 6 - "Clipboard Security & Favorites"
Cohesion: 0.1
Nodes (13): FavoritesPage, clearClipboard(), manager, text, ClipboardClearCallback, ClipboardCountdownCallback, clipboardManager, copyPassword() (+5 more)

### Community 7 - "UI Form Elements"
Cohesion: 0.08
Nodes (26): confirmInput, debugState, emailInput, errorElements, passwordInput, settingsButton, signoutButton, submitButton (+18 more)

### Community 8 - "TOTP Edge Cases"
Cohesion: 0.08
Nodes (25): afterLeap, afterLeapTime, beforeLeap, beforeLeapTime, code6, code7, code8, codeAfter (+17 more)

### Community 9 - "Service Worker Strategy"
Cohesion: 0.21
Nodes (7): CacheFirst, executeQuotaErrorCallbacks(), getFriendlyURL(), PrecacheStrategy, Strategy, StrategyHandler, toRequest()

### Community 10 - "Integration Tests"
Cohesion: 0.11
Nodes (18): encryptedSecret, encryptedVaultKey, lockCallback, loginCredentials, mockVaultKey, newTimeout, restoredKey, savedCredential (+10 more)

### Community 11 - "Vendor / Minified Code"
Cohesion: 0.2
Nodes (16): a, b(), C(), D, E(), G(), I(), j() (+8 more)

### Community 12 - "Browser Autofill Extension"
Cohesion: 0.14
Nodes (10): createAutofillOverlay(), detectedForms, detectLoginForms(), findPasswordField(), findUsernameField(), handleOutsideClick(), initializeAutofill(), removeAutofillOverlay() (+2 more)

### Community 13 - "Password Parsing & Preferences"
Cohesion: 0.14
Nodes (13): { result }, DEFAULT_OPTIONS, extractLabeledValue(), findStandalonePatterns(), looksLikePassword(), parseCredentialText(), ParsedCredential, PATTERNS (+5 more)

### Community 14 - "Security Documentation Hub"
Cohesion: 0.17
Nodes (18): TrustVault PWA Changelog, Biometric Button Visibility Fix (SigninPage/LoginPage), Changelog v1.0.0 Initial Production Release (2025-10-25), Changelog v1.0.1 Security Fixes (2026-05-14), Counter-based Replay Attack Prevention, Biometric Authentication Setup Guide, Phase 4.1 Biometric Authentication Summary, Phase 4.1 Biometric Authentication Implementation Summary (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (13): CacheableResponse, CacheableResponsePlugin, Deferred, isArray(), isArrayOfClass(), isInstance(), isOneOf(), PrecacheCacheKeyPlugin (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (8): getOrCreateDefaultRouter(), hasMethod(), isType(), normalizeHandler(), registerQuotaErrorCallback(), registerRoute(), Route, Router

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (8): addRoute(), createCacheKey(), getOrCreatePrecacheController(), precache(), precacheAndRoute(), PrecacheController, waitUntil(), createHandlerBoundToURL()

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (15): commandInjections, formatStrings, homographs, ldapInjections, maliciousUsernames, manyTags, nosqlInjections, nullByteAttempts (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (12): OnboardingTour(), OnboardingTourProps, getTourState(), isFirstTimeUser(), isTourCompleted(), markTourCompleted(), saveTourState(), TourConfig (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (5): initPerformanceMonitoring(), logPerformanceMetrics(), measureCLS(), measureFID(), measureLCP()

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (16): HIBP Breach Detection K-Anonymity Integration, OWASP Mobile Top 10 Compliance Checklist, OWASP Web Top 10 Compliance Checklist, Session and Memory Security Design, TOTP RFC 6238 Implementation, TrustVault PWA Security Audit Checklist, TrustVault PWA Security Audit Report, crypto-validation.test.ts (Security Tests) (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (12): __dirname, __filename, ICON_SIZES, ICON_TEMPLATE, MASKABLE_TEMPLATE, PUBLIC_DIR, CUSTOM_SW_PATH, customCode (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (14): AutofillMatch, batchStoreCredentials(), BrowserCredential, calculateMatchConfidence(), extractDomain(), extractOrigin(), findMatchingCredentials(), getCredentialFromBrowser() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (7): CryptoAPIErrorProps, AutoLockConfig, getDefaultAutoLockConfig(), useAutoLock(), AppContent(), AppRoutes(), rootElement

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (15): BreachAlertBanner UI Component, Have I Been Pwned API Integration, K-Anonymity Password Breach Check, TOTP (RFC 6238) Generation, Vault Key Decryption Flow, Vitest Test Framework, Zero-Knowledge Architecture, Breach Detection HIBP Integration Doc (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (6): CacheExpiration, CacheTimestampsModel, dontWaitFor(), normalizeURL(), openDB(), removeIgnoredSearchParams()

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (8): CameraScanDialog(), ScanState, OcrResultDialog(), PasswordStrengthIndicatorProps, TagInputProps, CATEGORIES, AddCredentialPage, EditCredentialPage

### Community 28 - "Community 28"
Cohesion: 0.27
Nodes (11): base32Decode(), base32Encode(), formatTOTPCode(), generateTOTP(), generateTOTPSecret(), getTOTPProgress(), getTOTPRemaining(), isValidTOTPSecret() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (8): AutoLockSettings(), TIMEOUT_OPTIONS, ClipboardSettings(), UpdateNotification(), ServiceWorkerUpdateState, SettingsPage, CredentialState, useCredentialStore

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (10): code, code1, code2, code3, codes, decoded, lower, remaining (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (10): afterAuth, afterCreate, beforeAuth, beforeCreate, failures, newSettings, partialSettings, promise1 (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (8): ImportDialog(), ImportMode, UnlockDialog(), UnlockDialogProps, readImportFile(), SignupPage, UnlockPage, useAuthStore

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (9): Automation & Quality Engineer Persona, Release Captain Persona, Security Architect Persona, UX Director Persona, CredOps Experience, Have I Been Pwned (HIBP) Integration, Passwordless & Recovery, Threat Intelligence & Reporting (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (11): Test Suite Status Report, Auth Store Test Suite (authStore.test.ts), Auto-Lock Hook Test Suite (useAutoLock.test.ts), Clipboard Utils Test Suite (clipboard.test.ts), Encryption Core Test Suite (encryption.test.ts), Integration Test Suite (integration.test.ts), Password Generator Hook Test Suite (usePasswordGenerator.test.ts), Password Hashing Test Suite (password.test.ts) (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.27
Nodes (8): ThemeToggle(), App(), ThemeMode, ThemeState, useThemeStore, createAppTheme(), getThemeOptions(), theme

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (8): AuthSession, User, WebAuthnCredential, AuthState, lockedSession, mockKey, session, state

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (8): maxTime, minTime, sessionCopy, sessionStr, storage, times, start, credential

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (5): { execSync }, fs, path, testDir, testFiles

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (4): CameraStream, CaptureResult, isCameraSupported(), requestCameraAccess()

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (7): DEFAULT_AUTOFILL_SETTINGS, excludeOrigin(), includeOrigin(), isAutofillEnabledForOrigin(), loadAutofillSettings(), saveAutofillSettings(), toggleAutofill()

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (5): SecuritySettings, initializeDatabase(), StoredCredential, StoredSession, StoredUser

### Community 42 - "Community 42"
Cohesion: 0.25
Nodes (6): mockNavigate, onLockCallback, addEventListenerSpy, config, removeEventListenerSpy, { unmount }

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (3): getWorker(), OCRProgress, recognizeText()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (7): Scrypt Password Hashing (N=32768,r=8,p=1), Database Migration (argon2 to scrypt), PBKDF2 Vault Key Encryption for Biometric Credentials, Migrated argon2 -> scrypt due to CSP and WASM loading issues, AES-256-GCM Authenticated Encryption, OWASP M10: Insufficient Cryptography Compliance, PBKDF2-SHA256 Key Derivation (600k iterations)

### Community 45 - "Community 45"
Cohesion: 0.47
Nodes (4): getCurrentTab(), loadCredentialsCount(), saveSettings(), showStatus()

### Community 46 - "Community 46"
Cohesion: 0.4
Nodes (5): exports, registry, require(), singleRequire(), specialDeps

### Community 50 - "Community 50"
Cohesion: 0.5
Nodes (5): Chrome Extension Autofill, Browser Credential Management API, Origin Validation for Autofill, Chrome Autofill Integration Guide, TrustVault Chrome Extension Popup

### Community 51 - "Community 51"
Cohesion: 0.4
Nodes (5): Content Security Policy Headers, @noble/hashes Library, Constant-Time Password Verification, Security Audit Checklist, Security Audit Report (Phase 5.3)

### Community 52 - "Community 52"
Cohesion: 0.5
Nodes (3): RecognizeResult, Worker, WorkerOptions

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (3): Argon2Options, Argon2Result, Argon2Type

### Community 56 - "Community 56"
Cohesion: 0.5
Nodes (3): Bundle Size Target (<500KB gzipped), Code Splitting & Lazy Loading, React.memo Optimization

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): SwipeGestureHandlers, SwipeGestureOptions, useSwipeGesture()

## Knowledge Gaps
- **329 isolated node(s):** `fs`, `path`, `{ execSync }`, `testDir`, `testFiles` (+324 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrustVaultDB` connect `Community 54` to `Community 41`, `Changelog & Passphrase Generator`, `Community 15`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `biometricVaultKey.ts` connect `Vault Key Encryption & Crypto Core` to `WebAuthn Authentication`, `Security Documentation Hub`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `timeout` connect `Integration Tests` to `Service Worker Strategy`, `Service Worker Cache Layer`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `{ execSync }` to the rest of the system?**
  _329 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Vault Key Encryption & Crypto Core` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `WebAuthn Authentication` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Breach Detection (HIBP)` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._