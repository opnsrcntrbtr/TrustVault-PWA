## 2026-06-12 - [XSS] URL Field Sanitization

**Vulnerability:** URL fields in `FavoritesPage` and `CredentialDetailsDialog` lacked validation and sanitization, allowing for potential stored Cross-Site Scripting (XSS) via `javascript:`, `data:`, `vbscript:`, and `file:` protocols in URLs.

**Learning:** When displaying user-provided URLs as `href` attributes or using them with `window.open()`, we must explicitly check for dangerous protocol schemes. Simple `startsWith('http')` checks can be easily bypassed by using the exact dangerous protocol, resulting in payloads like `https://javascript:alert(1)`, which may still be exploitable in some contexts or fail unexpectedly.

**Prevention:** All user-provided URLs should be normalized and sanitized using a dedicated utility (like `sanitizeUrl` in `src/presentation/utils/url.ts`) that strictly filters or drops URLs matching dangerous protocol schemes (`javascript:`, `data:`, `vbscript:`, `file:`) prior to being used in rendering logic or API calls.

## 2026-06-14 - [XSS] Control Characters in URL Bypassing Schemes

**Vulnerability:** URLs containing control characters, such as `java\nscript:alert(1)`, could bypass URL protocol validations (`new URL(...)` schemas or `.startsWith('javascript:')`) in `src/presentation/utils/url.ts`.

**Learning:** URL parsers in browsers effectively strip control characters like tabs (`\t`) or line feeds (`\n`) out of URLs during interpretation. However, JavaScript URL parsers, strict protocol matchers, or regular expressions without `\s` equivalents might fail to match them. This creates an XSS vulnerability vector.

**Prevention:** URLs should have all control characters `[\x00-\x1F\x7F-\x9F]` explicitly stripped out using `.replace(/[\x00-\x1F\x7F-\x9F]/g, '')` prior to ANY security-related checks or evaluation.

## 2026-06-19 - [Insecure Randomness] Math.random() usage in Vault Bridge

**Vulnerability:** Weak randomness using `Math.random()` to generate `requestId` in `chrome-extension/scripts/vault-bridge.js`.

**Learning:** `Math.random()` is not cryptographically secure and can generate predictable values. In security contexts (like generating identifiers that might be used to correlate or authorize messages in extensions between content scripts and background workers), predictable random values could potentially lead to spoofing attacks or other logic flaws where an attacker anticipates the IDs.

**Prevention:** Always use cryptographically secure random number generators such as `crypto.randomUUID()` or `crypto.getRandomValues()` instead of `Math.random()`, especially in components dealing with request identifiers or security tokens.

## 2026-06-25 - [XSS] Improper HTML Escaping via DOM textContent

**Vulnerability:** The `escapeHtml` function in `chrome-extension/scripts/content.js` relied on DOM `textContent` assignment (`div.textContent = text; return div.innerHTML;`) to escape HTML. This method correctly escapes `<`, `>`, and `&`, but **fails to escape quotation marks (`"` and `'`)**. If the output is ever used within an HTML attribute (e.g., `<input value="${escapeHtml(userInput)}">`), it allows for attribute-breakout XSS.

**Learning:** Relying on DOM `textContent` to `innerHTML` conversion is insufficient for comprehensive HTML escaping because it does not escape quotes, which are critical when data is interpolated into HTML attributes.

**Prevention:** Use an explicit regex-based replacement function for all five significant HTML special characters (`&`, `<`, `>`, `"`, and `'`) using their respective HTML entities to ensure complete safety across all HTML interpolation contexts.
