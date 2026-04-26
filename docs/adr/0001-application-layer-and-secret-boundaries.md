# ADR 0001: Application Layer And Secret Boundaries

## Status

Accepted

## Context

Presentation components previously called data repositories directly and often received fully decrypted credentials for list views. This made it easy for passwords, TOTP secrets, notes, and card secrets to remain in UI state longer than needed.

## Decision

Introduce `src/application/services` as the presentation-facing use-case layer. List and search flows use `CredentialSummary`. Explicit secret actions use `CredentialSecret` or full `Credential` records only where needed for edit, export, import, and audit.

## Consequences

- UI components can render dashboards without decrypted secrets.
- Repository adapters still own encryption/decryption details.
- Boundary checks can be enforced with ESLint and tests.
