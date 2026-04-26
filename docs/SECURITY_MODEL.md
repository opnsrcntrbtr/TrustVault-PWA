# TrustVault Security Model

## Goals

- Keep master passwords, derived keys, decrypted vault keys, and decrypted credential secrets out of persistent web storage.
- Persist only encrypted secrets in IndexedDB.
- Keep list/search UI on metadata summaries.
- Require explicit user action before decrypting or transmitting a credential secret.

## Session And Key Lifecycle

- The master password is verified with Scrypt.
- The password-derived key unwraps the encrypted master vault key.
- The imported vault `CryptoKey` lives in Zustand memory only and is not persisted.
- Persisted auth state stores a `PublicUser` only: id, email, display name, biometric count, timestamps, and security settings.
- Lock/logout clears the vault key; auto-lock also clears credential UI state through the credential store.

## Master Password Change

Changing the master password rewraps the existing master vault key with a new password-derived key. Credential rows are not deleted or recreated. This preserves IDs, favorites, TOTP secrets, card fields, breach metadata, timestamps, and audit history.

## Extension Autofill

The extension is a separate trust boundary. It must not store credentials in `chrome.storage`, must scope responses to the requesting tab origin, and must use nonce-bound short-lived requests. A compromised extension page should not be able to enumerate the vault without an unlocked PWA session and explicit user approval.

## Known Baseline Debt

- `npm audit` currently reports vulnerable transitive dependencies, including Vite/Vitest/Workbox-related packages and one critical advisory under `basic-ftp`.
- The repo's existing lint baseline has many unrelated strict-type errors. New architecture rules are still added so future direct boundary violations are visible.
- OCR still depends on version-pinned CDN assets. The long-term hardening path is to self-host Tesseract worker/core/language assets.
