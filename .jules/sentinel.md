## 2026-06-12 - [XSS] URL Field Sanitization

**Vulnerability:** URL fields in `FavoritesPage` and `CredentialDetailsDialog` lacked validation and sanitization, allowing for potential stored Cross-Site Scripting (XSS) via `javascript:`, `data:`, `vbscript:`, and `file:` protocols in URLs.

**Learning:** When displaying user-provided URLs as `href` attributes or using them with `window.open()`, we must explicitly check for dangerous protocol schemes. Simple `startsWith('http')` checks can be easily bypassed by using the exact dangerous protocol, resulting in payloads like `https://javascript:alert(1)`, which may still be exploitable in some contexts or fail unexpectedly.

**Prevention:** All user-provided URLs should be normalized and sanitized using a dedicated utility (like `sanitizeUrl` in `src/presentation/utils/url.ts`) that strictly filters or drops URLs matching dangerous protocol schemes (`javascript:`, `data:`, `vbscript:`, `file:`) prior to being used in rendering logic or API calls.

## 2026-06-14 - [XSS] Control Characters in URL Bypassing Schemes

**Vulnerability:** URLs containing control characters, such as `java\nscript:alert(1)`, could bypass URL protocol validations (`new URL(...)` schemas or `.startsWith('javascript:')`) in `src/presentation/utils/url.ts`.

**Learning:** URL parsers in browsers effectively strip control characters like tabs (`\t`) or line feeds (`\n`) out of URLs during interpretation. However, JavaScript URL parsers, strict protocol matchers, or regular expressions without `\s` equivalents might fail to match them. This creates an XSS vulnerability vector.

**Prevention:** URLs should have all control characters `[\x00-\x1F\x7F-\x9F]` explicitly stripped out using `.replace(/[\x00-\x1F\x7F-\x9F]/g, '')` prior to ANY security-related checks or evaluation.
