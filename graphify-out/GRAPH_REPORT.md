# Graph Report - .  (2026-06-09)

## Corpus Check
- 218 files · ~188,211 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1166 nodes · 2158 edges · 103 communities (76 shown, 27 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 127 edges (avg confidence: 0.83)
- Token cost: 89,500 input · 14,000 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & TOTP Core|Auth & TOTP Core]]
- [[_COMMUNITY_Biometric Vault Key (WebAuthn PRF)|Biometric Vault Key (WebAuthn PRF)]]
- [[_COMMUNITY_ImportExport UI|Import/Export UI]]
- [[_COMMUNITY_Secure Clipboard|Secure Clipboard]]
- [[_COMMUNITY_Project Config & Concepts|Project Config & Concepts]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Security Dialog Components|Security Dialog Components]]
- [[_COMMUNITY_Architecture & Security Concepts|Architecture & Security Concepts]]
- [[_COMMUNITY_Password Generator Engine|Password Generator Engine]]
- [[_COMMUNITY_Core UI Navigation|Core UI Navigation]]
- [[_COMMUNITY_Chrome Extension|Chrome Extension]]
- [[_COMMUNITY_User Domain Model|User Domain Model]]
- [[_COMMUNITY_Autofill Integration Docs|Autofill Integration Docs]]
- [[_COMMUNITY_Password Strength UI|Password Strength UI]]
- [[_COMMUNITY_Breach Detection UI|Breach Detection UI]]
- [[_COMMUNITY_Build Scripts|Build Scripts]]
- [[_COMMUNITY_Username Migration|Username Migration]]
- [[_COMMUNITY_Onboarding Tour|Onboarding Tour]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Performance Monitoring|Performance Monitoring]]
- [[_COMMUNITY_Credential List UI|Credential List UI]]
- [[_COMMUNITY_Category Display|Category Display]]
- [[_COMMUNITY_Crypto & Migration Concepts|Crypto & Migration Concepts]]
- [[_COMMUNITY_Core Architecture Concepts|Core Architecture Concepts]]
- [[_COMMUNITY_HIBP Breach Service|HIBP Breach Service]]
- [[_COMMUNITY_Auto-Lock Hook|Auto-Lock Hook]]
- [[_COMMUNITY_Credential Repository CRUD|Credential Repository CRUD]]
- [[_COMMUNITY_Extension Content Script|Extension Content Script]]
- [[_COMMUNITY_Argon2 Bundled Asset|Argon2 Bundled Asset]]
- [[_COMMUNITY_Credential Storage Layer|Credential Storage Layer]]
- [[_COMMUNITY_Biometric Setup Docs|Biometric Setup Docs]]
- [[_COMMUNITY_Crypto Dependencies|Crypto Dependencies]]
- [[_COMMUNITY_Browser Compatibility|Browser Compatibility]]
- [[_COMMUNITY_Credential Repository Interface|Credential Repository Interface]]
- [[_COMMUNITY_Biometric Migration|Biometric Migration]]
- [[_COMMUNITY_Theme Management|Theme Management]]
- [[_COMMUNITY_Metadata Encryption|Metadata Encryption]]
- [[_COMMUNITY_Rate Limiter|Rate Limiter]]
- [[_COMMUNITY_PWA Install & Update|PWA Install & Update]]
- [[_COMMUNITY_Security Policy Concepts|Security Policy Concepts]]
- [[_COMMUNITY_Time Formatting|Time Formatting]]
- [[_COMMUNITY_Node TypeScript Config|Node TypeScript Config]]
- [[_COMMUNITY_Autofill Settings|Autofill Settings]]
- [[_COMMUNITY_Breach Data Types|Breach Data Types]]
- [[_COMMUNITY_Platform & Runtime Concepts|Platform & Runtime Concepts]]
- [[_COMMUNITY_Clipboard Tests|Clipboard Tests]]
- [[_COMMUNITY_User Domain Types|User Domain Types]]
- [[_COMMUNITY_Lint Fix Script|Lint Fix Script]]
- [[_COMMUNITY_Icon Generation Script|Icon Generation Script]]
- [[_COMMUNITY_SW Version Injection|SW Version Injection]]
- [[_COMMUNITY_PWA Icons|PWA Icons]]
- [[_COMMUNITY_Vercel Config|Vercel Config]]
- [[_COMMUNITY_Extension Popup Script|Extension Popup Script]]
- [[_COMMUNITY_Test TypeScript Config|Test TypeScript Config]]
- [[_COMMUNITY_Chrome Extension Files|Chrome Extension Files]]
- [[_COMMUNITY_Claude Local Settings|Claude Local Settings]]
- [[_COMMUNITY_Master Password Change|Master Password Change]]
- [[_COMMUNITY_Auto-Lock Settings Component|Auto-Lock Settings Component]]
- [[_COMMUNITY_Crypto OWASP Concepts|Crypto OWASP Concepts]]
- [[_COMMUNITY_Swipe Gesture Hook|Swipe Gesture Hook]]
- [[_COMMUNITY_SVG Icon Assets|SVG Icon Assets]]
- [[_COMMUNITY_Config & Migration Docs|Config & Migration Docs]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Argon2 Type Declarations|Argon2 Type Declarations]]
- [[_COMMUNITY_Tesseract Type Declarations|Tesseract Type Declarations]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Tour UI Components|Tour UI Components]]
- [[_COMMUNITY_Icon Docs|Icon Docs]]
- [[_COMMUNITY_Service Worker Versioning|Service Worker Versioning]]
- [[_COMMUNITY_Vite Environment Types|Vite Environment Types]]
- [[_COMMUNITY_Auto-Lock Tests|Auto-Lock Tests]]
- [[_COMMUNITY_Extension Popup UI|Extension Popup UI]]
- [[_COMMUNITY_OCR Pipeline|OCR Pipeline]]
- [[_COMMUNITY_Deploy Fix Script|Deploy Fix Script]]
- [[_COMMUNITY_Analysis Docs|Analysis Docs]]
- [[_COMMUNITY_Contributing Docs|Contributing Docs]]
- [[_COMMUNITY_Deployment Docs|Deployment Docs]]
- [[_COMMUNITY_Deployment Summary|Deployment Summary]]
- [[_COMMUNITY_Getting Started Docs|Getting Started Docs]]
- [[_COMMUNITY_Setup Script|Setup Script]]
- [[_COMMUNITY_Integration Tests|Integration Tests]]
- [[_COMMUNITY_Argon2 Browser Types|Argon2 Browser Types]]
- [[_COMMUNITY_WebAuthn PRF Types|WebAuthn PRF Types]]
- [[_COMMUNITY_GitHub Funding|GitHub Funding]]
- [[_COMMUNITY_Deployment Verification|Deployment Verification]]
- [[_COMMUNITY_Quick Start Guide|Quick Start Guide]]
- [[_COMMUNITY_Memory Security Test|Memory Security Test]]
- [[_COMMUNITY_Password Gen Test|Password Gen Test]]
- [[_COMMUNITY_Password Edge Cases|Password Edge Cases]]
- [[_COMMUNITY_Argon2 Result Type|Argon2 Result Type]]
- [[_COMMUNITY_Tesseract Worker|Tesseract Worker]]
- [[_COMMUNITY_Tesseract Result Type|Tesseract Result Type]]
- [[_COMMUNITY_Tesseract Worker Type|Tesseract Worker Type]]

## God Nodes (most connected - your core abstractions)
1. `useAuthStore` - 43 edges
2. `CredentialRepository` - 35 edges
3. `encrypt()` - 31 edges
4. `UserRepositoryImpl` - 29 edges
5. `compilerOptions` - 28 edges
6. `deriveKeyFromPassword()` - 23 edges
7. `decrypt()` - 22 edges
8. `scripts` - 21 edges
9. `Package.json - Project Manifest` - 19 edges
10. `db` - 17 edges

## Surprising Connections (you probably didn't know these)
- `stripLegacyBiometric()` --implements--> `DB v6 Migration (Legacy Biometric Strip)`  [INFERRED]
  src/core/auth/biometricMigration.ts → SECURITY.md
- `CodeQL Advanced Security Scanning Workflow` --references--> `Package.json - Project Manifest`  [INFERRED]
  .github/workflows/codeql.yml → package.json
- `Vite Build Configuration` --rationale_for--> `WASM/UMD Lazy Dynamic Import Pattern`  [INFERRED]
  vite.config.ts → .github/copilot-instructions.md
- `CredOps Experience Pillar` --conceptually_related_to--> `zxcvbn (Password Strength)`  [INFERRED]
  AGENTS.md → package.json
- `Copilot Instructions Document` --references--> `@simplewebauthn/browser (WebAuthn)`  [EXTRACTED]
  .github/copilot-instructions.md → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI/CD Deployment Pipelines** — github_deploy_ghpages_workflow, github_deploy_workflow, root_vercel_json, root_deploy_fix_sh [INFERRED 0.95]
- **Security & Cryptography Stack** — concept_scrypt_password_hashing, concept_pbkdf2_key_derivation, concept_aes_gcm_encryption, concept_webauthn_prf_biometric, dep_noble_hashes, dep_simplewebauthn_browser [INFERRED 0.95]
- **TypeScript Configuration Chain** — root_tsconfig, root_tsconfig_node, root_tsconfig_test, root_eslint_config [EXTRACTED 1.00]
- **TrustVault Four Development Pillars** — concept_vault_trust_hardening, concept_credops_experience, concept_passwordless_recovery, concept_threat_intelligence [EXTRACTED 1.00]
- **Frontend Vendor Code Split Chunks** — dep_react19, dep_mui, dep_noble_hashes, dep_dexie, dep_simplewebauthn_browser [EXTRACTED 1.00]
- **Autofill Security Architecture (Origin Validation + HTTPS + CSP)** — root_autofill_integration_origin_validation, root_autofill_integration_credential_management_service, root_csp_troubleshooting_csp_policy [INFERRED 0.75]
- **Biometric Authentication Implementation Stack** — root_phase_4_1_biometric_auth_webauthn_ts, root_phase_4_1_biometric_auth_biometric_vault_key, root_phase_4_1_biometric_auth_biometric_setup_dialog, root_biometric_setup_guide_webauthn [EXTRACTED 0.95]
- **Phase 0 Critical Bug Fixes (Vault Key + Credential Decryption)** — root_blueprint_vault_key_decryption_bug, root_blueprint_credential_decryption_bug, root_key_findings_doc, root_final_delivery_summary_doc [INFERRED 0.85]
- **Breach Detection Feature Components** — root_breach_detection_readme_hibp_service, root_breach_detection_readme_breach_results_repo, root_breach_detection_readme_breach_alert_banner, root_breach_detection_readme_breach_details_modal, root_breach_detection_readme_k_anonymity [EXTRACTED 0.95]
- **Deployment Documentation Cluster** — root_deployment_doc, root_deployment_guide_doc, root_deployment_summary_doc, root_deployment_verification_doc, root_getting_started_doc [INFERRED 0.75]
- **TrustVault Security Pillars** — concept_zero_knowledge_architecture, concept_webauthn_prf_unlock, concept_aes_256_gcm_encryption, concept_scrypt_password_hashing, concept_pbkdf2_key_derivation, concept_hkdf_wrap_key [EXTRACTED 1.00]
- **2025 Q4 Enhancement Pillars** — concept_vault_trust_hardening, concept_credops_experience, concept_passwordless_recovery, concept_threat_intelligence [EXTRACTED 1.00]
- **Chrome Extension Components** — chrome_extension_manifest_json, chrome_extension_background_js, chrome_extension_content_js, chrome_extension_popup_js [EXTRACTED 1.00]
- **OWASP Mobile Top 10 Implementation** — concept_owasp_mobile_top10, concept_zero_knowledge_architecture, concept_aes_256_gcm_encryption, concept_content_security_policy, concept_pwa_service_worker [EXTRACTED 1.00]
- **OWASP Security Test Suite** — tests_security_crypto_validation_test, tests_security_input_validation_test, tests_security_session_storage_test, concept_owasp_m3_insecure_auth, concept_owasp_m4_input_validation, concept_owasp_m9_data_storage, concept_owasp_m10_crypto [INFERRED 0.95]
- **Rate Limiting Feature Plan** — docs_rate_limiting_plan, docs_rate_limiting_spec, concept_rate_limiter_module, docs_rate_limiting_stored_login_attempt, docs_rate_limiting_exponential_backoff, concept_database_ts, concept_user_repository_impl [EXTRACTED 1.00]
- **PWA Icon Generation Pipeline** — scripts_generate_icons_generator, public_icons_readme_pwa_icon_spec, public_icons_readme_maskable_icons [INFERRED 0.85]
- **Service Worker Version Pipeline** — scripts_inject_sw_version_injector, public_sw_custom_version_management, public_sw_custom_skip_waiting [EXTRACTED 1.00]
- **Integration Test Suite** — tests_integration_auth_flow_test, tests_integration_import_export_test, tests_integration_master_password_change_test, tests_integration_ocr_capture_test, concept_presentation_app, concept_auth_store, concept_database_ts [EXTRACTED 1.00]
- **Onboarding Tour Components** — components_onboarding_tour, components_tour_help_button, concept_use_driver_tour [EXTRACTED 1.00]
- **Security Headers System** — config_securityheaders_csp, config_securityheaders_hibp_origins, config_securityheaders_headers_object, config_securityheaders_test, concept_vercel_json [EXTRACTED 1.00]
- **PRF Vault Key Wrapping System** — auth_webauthn_getprfoutput, auth_webauthn_registercredentialwithprf, auth_biometricvaultkey_wrapvaultkeywithprf, auth_biometricvaultkey_unwrapvaultkeywithprf, auth_biometricvaultkey_derivewrapkeyfromprf, auth_biometricvaultkey_generateprfsalt, concept_zero_knowledge_biometric [INFERRED 0.95]
- **Database Migration System** — auth_biometricmigration_striplegacybiometric, auth_biometricmigration_isprf_credential, auth_usernamemigration_deriveuniquesernames, auth_usernamemigration_deriveusernamestem, concept_db_v6_migration, concept_db_v7_username_migration [INFERRED 0.90]
- **WebAuthn Service Functions** — auth_webauthn_iswebauthn_supported, auth_webauthn_isBiometricAvailable, auth_webauthn_registerbiometric, auth_webauthn_authenticatebiometric, auth_webauthn_verifyregistrationresponse, auth_webauthn_verifyauthenticationresponse, auth_webauthn_getdevicename, auth_webauthn_detectprfsupport, auth_webauthn_isprfsupported, auth_webauthn_registercredentialwithprf, auth_webauthn_getprfoutput [EXTRACTED 1.00]
- **TOTP Functions** — auth_totp_generatetotp, auth_totp_verifytotp, auth_totp_base32decode, auth_totp_base32encode, auth_totp_formattotpcode, auth_totp_gettotpremaining, auth_totp_gettotpprogress, auth_totp_isvalidtotpsecret, auth_totp_generatetotpsecret [EXTRACTED 1.00]
- **Breach Detection System** — breach_hibpservice_checkpasswordbreach, breach_hibpservice_checkemailbreach, breach_breachtypes_breachcheck_result, breach_breachtypes_breachseverity, breach_breachtypes_breachdata, concept_k_anonymity [INFERRED 0.95]
- **AES-256-GCM Vault Encryption Pipeline** — crypto_encryption_encrypt, crypto_encryption_decrypt, crypto_encryption_derivekeyfrompassword, repositories_credentialrepositoryimpl_class, repositories_userrepositoryimpl_authenticatewithpassword [INFERRED 0.95]
- **S5 Metadata Encryption Sealing Pipeline** — repositories_metadatasealing_seallegacymetadata, repositories_credentialrepositoryimpl_class, storage_database_storedcredential, crypto_encryption_encrypt [EXTRACTED 1.00]
- **OCR Credential Capture Pipeline** — ocr_cameracapture_captureframe, ocr_tesseractservice_recognizetext, ocr_credentialparser_parsecredentialtext, ocr_cameracapture_clearimagedata [INFERRED 0.85]
- **Breach Detection UI Flow** — components_breachalertbanner_breachalertbanner, components_credentialdetailsdialog_credentialdetailsdialog, components_breachdetailsmodal_breachdetailsmodal [INFERRED 0.95]
- **Vault Security Settings Flow** — components_autolocksettings_autolocksettings, components_clipboardsettings_clipboardsettings, components_biometricsetupdialog_biometricsetupdialog [INFERRED 0.85]
- **Password Generator Pipeline** — generator_passwordgenerator_generatepassword, generator_passphrasegenerator_generatepassphrase, generator_strengthanalyzer_analyzepasswordstrength [EXTRACTED 1.00]
- **Vault Import/Export Flow** — components_exportdialog_exportdialog, components_importdialog_importdialog, core_crypto_exportencryption [EXTRACTED 1.00]
- **Credential Browse and Filter Flow** — components_searchbar_searchbar, components_filterchips_filterchips, components_sortdropdown_sortdropdown [INFERRED 0.95]
- **Password Generation and Strength Flow** — components_passwordgeneratordialog_passwordgeneratordialog, components_passwordstrengthindicator_passwordstrengthindicator, hooks_usepasswordgenerator [EXTRACTED 1.00]
- **Credential CRUD Flow** — pages_addcredentialpage_addcredentialpage, pages_editcredentialpage_editcredentialpage, pages_credentialdetailpage_credentialdetailpage, pages_dashboardpage_dashboardpage, store_authstore_useauthstore [INFERRED 0.95]
- **Authentication Sign-in/Sign-up Flow** — pages_signinpage_signinpage, pages_signuppage_signuppage, pages_unlockpage_unlockpage, store_authstore_useauthstore [EXTRACTED 1.00]
- **Security & Session Management Flow** — hooks_useautolock_useautolock, store_authstore_useauthstore, store_credentialstore_usecredentialstore, pages_settingspage_settingspage [INFERRED 0.85]

## Communities (103 total, 27 thin omitted)

### Community 0 - "Auth & TOTP Core"
Cohesion: 0.06
Nodes (64): base32Decode(), base32Encode(), formatTOTPCode(), generateTOTP(), generateTOTPSecret(), getTOTPProgress(), getTOTPRemaining(), isValidTOTPSecret() (+56 more)

### Community 1 - "Biometric Vault Key (WebAuthn PRF)"
Cohesion: 0.09
Nodes (44): deriveWrapKeyFromPRF(), generatePrfSalt(), unwrapVaultKeyWithPRF(), wrapVaultKeyWithPRF(), authenticateBiometric(), BiometricCredential, detectPRFSupport(), generateChallenge() (+36 more)

### Community 2 - "Import/Export UI"
Cohesion: 0.10
Nodes (41): ExportDialogProps, ImportDialogProps, ImportMode, arrayBufferToBase64(), base64ToArrayBuffer(), computeHash(), constantTimeEqual(), decrypt() (+33 more)

### Community 3 - "Secure Clipboard"
Cohesion: 0.06
Nodes (34): ClipboardNotification(), ClipboardNotificationProps, ClipboardSettings(), ClipboardSettingsProps, TIMEOUT_OPTIONS, PasswordGeneratorDialog(), PasswordGeneratorDialogProps, PasswordStrengthIndicator() (+26 more)

### Community 4 - "Project Config & Concepts"
Cohesion: 0.05
Nodes (46): PreToolUse Graphify Hook, Code Splitting via manualChunks, HTTP Security Headers (CSP, X-Frame-Options, HSTS), WASM/UMD Lazy Dynamic Import Pattern, argon2-browser (Legacy, Excluded from optimizeDeps), vite-plugin-pwa (PWA Service Worker), Vitest (Test Framework), devDependencies (+38 more)

### Community 5 - "TypeScript Configuration"
Cohesion: 0.05
Nodes (36): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, baseUrl, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes (+28 more)

### Community 6 - "Security Dialog Components"
Cohesion: 0.10
Nodes (24): BiometricSetupDialog(), ChangeMasterPasswordDialog(), ExportDialog(), ImportDialog(), UnlockDialog(), UnlockDialogProps, Clipboard Auto-Clear Security Concept, Vault Key Memory-Only Security Concept (+16 more)

### Community 7 - "Architecture & Security Concepts"
Cohesion: 0.10
Nodes (30): useAuthStore (Zustand), CredentialRepository, useCredentialStore (Zustand), TrustVaultDB (database.ts), OWASP M3: Insecure Authentication, OWASP M4: Insufficient Input Validation, OWASP M9: Insecure Data Storage, Presentation App Component (+22 more)

### Community 8 - "Password Generator Engine"
Cohesion: 0.14
Nodes (25): Generator Feature Index, capitalizeWord(), DICEWARE_WORDS, generateMemorablePassphrase(), generatePassphrase(), getDefaultPassphraseOptions(), getRandomIndex(), getRandomSeparator() (+17 more)

### Community 9 - "Core UI Navigation"
Cohesion: 0.08
Nodes (22): CryptoAPIError(), CryptoAPIErrorProps, MobileNavigation(), OfflineIndicator(), getDefaultAutoLockConfig(), AddCredentialPage, App(), AppContent() (+14 more)

### Community 10 - "Chrome Extension"
Cohesion: 0.08
Nodes (25): action, default_icon, default_popup, background, service_worker, type, content_scripts, content_security_policy (+17 more)

### Community 11 - "User Domain Model"
Cohesion: 0.14
Nodes (5): AuthSession, SecuritySettings, User, UserRepositoryImpl, AuthState

### Community 12 - "Autofill Integration Docs"
Cohesion: 0.10
Nodes (26): autofillSettings.ts, Chrome Extension for Enhanced Autofill, Native Credential Management API, credentialManagementService.ts, TrustVault Chrome Autofill Integration Guide, Origin Validation for Autofill Security, useAutoLock Hook - Inactivity & Tab Visibility Lock, Credentials Returned Encrypted Bug (Finding #2) (+18 more)

### Community 13 - "Password Strength UI"
Cohesion: 0.14
Nodes (10): PasswordStrengthIndicatorProps, analyzePasswordStrength(), calculateActualEntropy(), COMMON_PATTERNS, convertZxcvbnScore(), detectCommonPatterns(), determineStrength(), formatCrackTime() (+2 more)

### Community 14 - "Breach Detection UI"
Cohesion: 0.15
Nodes (16): BreachCheckResult, isHibpEnabled(), BreachAlertBanner(), BreachAlertBannerProps, BreachDetailsModal(), CredentialDetailsDialog(), CredentialDetailsDialogProps, Transition (+8 more)

### Community 15 - "Build Scripts"
Cohesion: 0.10
Nodes (21): scripts, analyze:bundle, build, build:deploy, dev, dev:https, format, format:check (+13 more)

### Community 16 - "Username Migration"
Cohesion: 0.21
Nodes (15): deriveUniqueUsernames, deriveUniqueUsernames(), deriveUsernameStem(), makeUnique(), MigratableUser, UsernameAssignment, normalizeUsername(), RESERVED_USERNAMES (+7 more)

### Community 17 - "Onboarding Tour"
Cohesion: 0.18
Nodes (15): OnboardingTour(), OnboardingTourProps, TourHelpButton(), getTourState(), isFirstTimeUser(), isTourCompleted(), markTourCompleted(), saveTourState() (+7 more)

### Community 18 - "Package Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, argon2-browser, chroncraft, dexie, dexie-encrypted, driver.js, @emotion/react, @emotion/styled (+12 more)

### Community 19 - "Performance Monitoring"
Cohesion: 0.15
Nodes (7): Web Vitals Performance Monitoring, initPerformanceMonitoring(), logPerformanceMetrics(), measureCLS(), measureFID(), measureLCP(), ImportMetaEnv Interface

### Community 20 - "Credential List UI"
Cohesion: 0.14
Nodes (12): DeleteConfirmDialog(), DeleteConfirmDialogProps, CATEGORY_OPTIONS, FilterChips(), FilterChipsProps, SearchBar(), SearchBarProps, SORT_OPTIONS (+4 more)

### Community 21 - "Category Display"
Cohesion: 0.22
Nodes (12): CategoryIcon(), CategoryIconProps, getCategoryColor(), getCategoryIcon(), getCategoryName(), CredentialCard, CredentialCardProps, CredentialSection() (+4 more)

### Community 22 - "Crypto & Migration Concepts"
Cohesion: 0.23
Nodes (12): AES-256-GCM Credential Encryption, DB v6 Migration (Legacy Biometric Strip), HKDF-SHA256 PRF Wrap Key Derivation, IndexedDB via Dexie (Encrypted Storage), PBKDF2-SHA256 Key Derivation (600k iterations), PWA Service Worker (Workbox), WebAuthn PRF Vault Unlock (S1), Zero-Knowledge Architecture (+4 more)

### Community 23 - "Core Architecture Concepts"
Cohesion: 0.19
Nodes (14): AES-256-GCM Authenticated Encryption, Auto-Lock Session Mechanism, Clean Architecture (Domain/Data/Presentation Layers), CredOps Experience Pillar, Encrypted Vault Import/Export (.tvault), OCR Credential Capture (Tesseract.js), Passwordless & Recovery Pillar, Secure Clipboard Auto-Clear (+6 more)

### Community 24 - "HIBP Breach Service"
Cohesion: 0.24
Nodes (11): BreachCheckResult Interface, breachCache, checkEmailBreach(), checkPasswordBreach(), clearBreachCache(), enforceRateLimit(), handleApiError(), hashPassword() (+3 more)

### Community 25 - "Auto-Lock Hook"
Cohesion: 0.23
Nodes (10): Auto-Lock Inactivity Concept, AutoLockConfig, AutoLockConfig Interface, getDefaultAutoLockConfig Function, mockNavigate, useAutoLock(), SettingsPage(), CredentialState (+2 more)

### Community 26 - "Credential Repository CRUD"
Cohesion: 0.18
Nodes (5): CredentialRepository, AuthSession, AuthState, createAuthStore(), User

### Community 27 - "Extension Content Script"
Cohesion: 0.20
Nodes (10): createAutofillOverlay(), detectedForms, detectLoginForms(), findPasswordField(), findUsernameField(), handleOutsideClick(), initializeAutofill(), observer (+2 more)

### Community 28 - "Argon2 Bundled Asset"
Cohesion: 0.33
Nodes (10): b(), C(), E(), G(), I(), j(), L(), q() (+2 more)

### Community 29 - "Credential Storage Layer"
Cohesion: 0.15
Nodes (3): CredentialRepository.create(), TrustVaultDB, clearAllData()

### Community 30 - "Biometric Setup Docs"
Cohesion: 0.21
Nodes (13): Counter-Based Replay Attack Prevention, Biometric Authentication Setup Guide, Hardware Security Keys (YubiKey, Titan Key), WebAuthn/FIDO2 Biometric Authentication, Biometric Button Visibility Fix (DB State vs Hardware), TrustVault PWA Changelog, PBKDF2 600k Iterations OWASP 2025 Alignment, WebAuthn Challenge Verification Fix (v1.0.1) (+5 more)

### Community 31 - "Crypto Dependencies"
Cohesion: 0.17
Nodes (12): WebAuthn PRF Extension Biometric Unlock, fake-indexeddb (Test Utility), @mui/material (Material UI), React 19, @simplewebauthn/browser (WebAuthn), Tesseract.js (OCR), Zod (Schema Validation), CodeQL Advanced Security Scanning Workflow (+4 more)

### Community 32 - "Browser Compatibility"
Cohesion: 0.17
Nodes (11): browserslist, development, production, description, engines, node, npm, name (+3 more)

### Community 33 - "Credential Repository Interface"
Cohesion: 0.29
Nodes (4): ICredentialRepository, db, StoredLoginAttempt, StoredSession

### Community 34 - "Biometric Migration"
Cohesion: 0.29
Nodes (9): isPrfCredential, isPrfCredential(), stripLegacyBiometric(), StripResult, PRF Vault Key Scheme (prf-v1), WebAuthnCredential, biometricMigration Tests, legacy (+1 more)

### Community 35 - "Theme Management"
Cohesion: 0.29
Nodes (8): ThemeToggle(), ThemeMode, ThemeState, useThemeStore, createAppTheme(), getThemeOptions(), theme, ThemeMode Type Reference

### Community 36 - "Metadata Encryption"
Cohesion: 0.33
Nodes (7): CredentialRepository Class, encryptField(), encryptOptional(), sealLegacyMetadata(), StoredCredential, Copilot Review Fixes Test Suite, Metadata Encryption Test Suite

### Community 37 - "Rate Limiter"
Cohesion: 0.42
Nodes (7): checkRateLimit(), clearAttempts(), formatRemaining(), lockoutMs(), recordFailedAttempt(), THRESHOLDS, rateLimiter Tests

### Community 38 - "PWA Install & Update"
Cohesion: 0.27
Nodes (5): InstallPrompt(), UpdateAvailableSnackbar(), UpdateNotification(), ServiceWorkerUpdateState, useServiceWorkerUpdate()

### Community 39 - "Security Policy Concepts"
Cohesion: 0.27
Nodes (7): Content Security Policy (CSP), HIBP Breach Detection (k-Anonymity), Metadata-at-Rest Encryption (S5), OWASP Mobile Top 10 2025 Compliance, Threat Intelligence & Reporting Pillar, CSP unsafe-inline Gap (S2), zxcvbn (Password Strength)

### Community 40 - "Time Formatting"
Cohesion: 0.53
Nodes (8): chroncraft Library, formatAbsoluteDate(), formatDistanceToNow(), formatFullDateTime(), formatRelativeTime(), formatShortRelativeTime(), formatSmartTime(), timeFormat Test Suite

### Community 41 - "Node TypeScript Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowSyntheticDefaultImports, composite, emitDeclarationOnly, module, moduleResolution, skipLibCheck, strict (+1 more)

### Community 42 - "Autofill Settings"
Cohesion: 0.42
Nodes (8): AutofillSettings, DEFAULT_AUTOFILL_SETTINGS, excludeOrigin(), includeOrigin(), isAutofillEnabledForOrigin(), loadAutofillSettings(), saveAutofillSettings(), toggleAutofill()

### Community 43 - "Breach Data Types"
Cohesion: 0.33
Nodes (7): BreachCheckOptions, BreachData, BreachSeverity, HibpError, RateLimitState, StoredBreachResult, BreachDetailsModalProps

### Community 44 - "Platform & Runtime Concepts"
Cohesion: 0.31
Nodes (9): Offline-First PWA Pattern, React 19 StrictMode Double Render Cleanup Pattern, Scrypt Password Hashing (N=32768, r=8, p=1), TrustVault PWA Application, Dexie (IndexedDB ORM), @noble/hashes (Scrypt, PBKDF2), Zustand (State Management), Copilot Instructions Document (+1 more)

### Community 46 - "User Domain Types"
Cohesion: 0.29
Nodes (8): AuthSession Interface, User Domain Interface, SecuritySettings Interface, WebAuthnCredential Interface, UserRepositoryImpl Class, StoredUser, CredentialRepositoryImpl Test Suite, UserRepositoryImpl Test Suite

### Community 47 - "Lint Fix Script"
Cohesion: 0.25
Nodes (5): { execSync }, fs, path, testDir, testFiles

### Community 48 - "Icon Generation Script"
Cohesion: 0.25
Nodes (6): __dirname, __filename, ICON_SIZES, ICON_TEMPLATE, MASKABLE_TEMPLATE, PUBLIC_DIR

### Community 49 - "SW Version Injection"
Cohesion: 0.25
Nodes (7): CUSTOM_SW_PATH, __dirname, DIST_DIR, __filename, PACKAGE_JSON_PATH, packageJson, SW_PATH

### Community 50 - "PWA Icons"
Cohesion: 0.57
Nodes (7): Apple Touch Icon (180x180) — TrustVault, Favicon 32x32 — TrustVault, PWA App Icon 192x192 — TrustVault, PWA App Icon 512x512 — TrustVault, PWA Maskable Icon 192x192 — TrustVault, PWA Maskable Icon 512x512 — TrustVault, TrustVault Visual Brand Identity

### Community 51 - "Vercel Config"
Cohesion: 0.29
Nodes (6): buildCommand, framework, headers, outputDirectory, rewrites, $schema

### Community 52 - "Extension Popup Script"
Cohesion: 0.47
Nodes (4): getCurrentTab(), loadCredentialsCount(), saveSettings(), showStatus()

### Community 53 - "Test TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, types, exclude, extends, include

### Community 54 - "Chrome Extension Files"
Cohesion: 0.60
Nodes (5): Chrome Extension Background Service Worker, Chrome Extension Content Script (Autofill), Chrome Extension Manifest (MV3), Chrome Extension Popup Script, Chrome Extension Autofill

### Community 55 - "Claude Local Settings"
Cohesion: 0.40
Nodes (4): permissions, allow, ask, deny

### Community 56 - "Master Password Change"
Cohesion: 0.40
Nodes (3): ChangeMasterPasswordDialogProps, ReEncryptionProgress(), ReEncryptionProgressProps

### Community 58 - "Auto-Lock Settings Component"
Cohesion: 0.50
Nodes (3): AutoLockSettings(), AutoLockSettingsProps, TIMEOUT_OPTIONS

### Community 59 - "Crypto OWASP Concepts"
Cohesion: 0.50
Nodes (4): core/crypto/encryption (encrypt, decrypt, deriveKeyFromPassword), core/crypto/password (hashPassword, verifyPassword, generateSecurePassword), OWASP M10: Insufficient Cryptography, Cryptographic Security Validation Tests

### Community 61 - "SVG Icon Assets"
Cohesion: 1.00
Nodes (4): Maskable PWA Icon Template SVG, Standard PWA Icon Template SVG, TrustVault Icon Design System, PWA App Icon SVG

### Community 62 - "Config & Migration Docs"
Cohesion: 0.50
Nodes (4): Content Security Policy Configuration, CSP Troubleshooting Guide, Database Migration - Argon2 to Scrypt, Argon2-browser to Scrypt Migration Rationale

### Community 63 - "ESLint Config"
Cohesion: 0.83
Nodes (4): ESLint Configuration, TypeScript Configuration (tsconfig.json), TypeScript Node Configuration (tsconfig.node.json), TypeScript Test Configuration (tsconfig.test.json)

### Community 64 - "Argon2 Type Declarations"
Cohesion: 0.50
Nodes (3): Argon2Options, Argon2Result, Argon2Type

### Community 65 - "Tesseract Type Declarations"
Cohesion: 0.50
Nodes (3): RecognizeResult, Worker, WorkerOptions

### Community 67 - "Tour UI Components"
Cohesion: 0.67
Nodes (3): OnboardingTour Component, TourHelpButton Component, useDriverTour Hook

### Community 68 - "Icon Docs"
Cohesion: 0.67
Nodes (3): Maskable Icon Guidelines, PWA Icon Specification, PWA Icon Generator Script

### Community 69 - "Service Worker Versioning"
Cohesion: 0.67
Nodes (3): Service Worker Skip Waiting Handler, Service Worker Version Management, Service Worker Version Injector

## Knowledge Gaps
- **384 isolated node(s):** `PreToolUse`, `allow`, `deny`, `ask`, `manifest_version` (+379 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `stripLegacyBiometric()` connect `Biometric Migration` to `Credential Repository Interface`, `Rate Limiter`, `User Domain Model`, `Username Migration`, `Crypto & Migration Concepts`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `DB v6 Migration (Legacy Biometric Strip)` connect `Crypto & Migration Concepts` to `Biometric Migration`, `Core Architecture Concepts`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Project Config & Concepts` to `Browser Compatibility`, `Crypto Dependencies`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `allow`, `deny` to the rest of the system?**
  _390 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & TOTP Core` be split into smaller, more focused modules?**
  _Cohesion score 0.061708860759493674 - nodes in this community are weakly interconnected._
- **Should `Biometric Vault Key (WebAuthn PRF)` be split into smaller, more focused modules?**
  _Cohesion score 0.08757062146892655 - nodes in this community are weakly interconnected._
- **Should `Import/Export UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1013277428371768 - nodes in this community are weakly interconnected._