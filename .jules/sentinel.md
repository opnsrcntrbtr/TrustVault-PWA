## 2026-06-12 - [XSS] URL Field Sanitization

**Vulnerability:** URL fields in `FavoritesPage` and `CredentialDetailsDialog` lacked validation and sanitization, allowing for potential stored Cross-Site Scripting (XSS) via `javascript:`, `data:`, `vbscript:`, and `file:` protocols in URLs.

**Learning:** When displaying user-provided URLs as `href` attributes or using them with `window.open()`, we must explicitly check for dangerous protocol schemes. Simple `startsWith('http')` checks can be easily bypassed by using the exact dangerous protocol, resulting in payloads like `https://javascript:alert(1)`, which may still be exploitable in some contexts or fail unexpectedly.

**Prevention:** All user-provided URLs should be normalized and sanitized using a dedicated utility (like `sanitizeUrl` in `src/presentation/utils/url.ts`) that strictly filters or drops URLs matching dangerous protocol schemes (`javascript:`, `data:`, `vbscript:`, `file:`) prior to being used in rendering logic or API calls.
