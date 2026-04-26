# TrustVault Architecture

TrustVault is a local-first React PWA with an optional Chrome autofill extension. The security boundary is the unlocked vault session: decrypted credential secrets may exist in memory only after the user unlocks the vault and only for an explicit action such as reveal, copy, edit, export, audit, or extension fill approval.

## Layers

- `domain`: entity and repository contracts. It has no dependency on application, data, presentation, feature, or core adapters.
- `core`: low-level crypto, auth primitives, OCR, breach clients, and platform utilities. It does not import feature, presentation, or data modules.
- `data`: IndexedDB/Dexie adapters implementing domain repository contracts.
- `application`: use-case services that coordinate data adapters and domain/core behavior. Presentation code talks to this layer.
- `presentation`: React pages, components, hooks, and UI state.
- `chrome-extension`: an on-demand extension bridge that requests credentials from the unlocked PWA and never persists credential secrets.

## Credential Data Shapes

- `CredentialSummary` is safe for dashboards, search, favorites, and cards. It excludes password, TOTP secret, CVV, card number, and notes.
- `CredentialSecret` is returned only for explicit secret actions.
- `Credential` remains the decrypted full record for edit, export, import, and security audit flows.

## Dependency Rules

Presentation must not import `@/data/*`; it uses `@/application/services/*`. Core must not import `@/features/*`, `@/presentation/*`, or `@/data/*`. These rules are enforced by ESLint and by `src/__tests__/architecture/architecture-boundaries.test.ts`.

## Extension Boundary

The extension uses `activeTab` and `scripting` for explicit on-demand fills. It opens the PWA with a nonce, target origin, and extension id. The unlocked PWA filters credentials to the target origin, asks the user for approval, and sends matching credentials back through `chrome.runtime.sendMessage`. The extension keeps returned secrets in memory only long enough for the user to click a fill choice.
