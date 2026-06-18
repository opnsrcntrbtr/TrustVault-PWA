# Core: Autofill (`src/core/autofill/`)

## Purpose

Provides credential matching and autofill integration with browser & Chrome extension:
- Find matching credentials for a domain using dot-boundary host-suffix matching
- Store/retrieve credentials from browser's Credential Management API
- Communicate with Chrome extension via `chrome.runtime.sendMessage`
- Per-origin opt-in settings (allow-list)

## Public API

### Credential Matching

```typescript
import {
  findMatchingCredentials,
  calculateMatchConfidence,
  extractOrigin,
  validateDomain,
} from '@/core/autofill';

// Find credentials for a domain
const matches = await findMatchingCredentials(
  { origin: 'https://mybank.co.uk', username: 'john' },
  credentials
);
// → [{ credential, confidence: 0.95 }]

// Validate domain safety (dot-boundary matching, not naive eTLD)
const isValid = validateDomain('mybank.co.uk', 'evil.co.uk');
// → false (not a valid match)
```

**Invariants:**
- Dot-boundary matching: `mybank.co.uk` matches `mail.mybank.co.uk` ✅
- Dot-boundary matching: `mybank.co.uk` does NOT match `evil.co.uk` ❌
- Scheme equality: `https://` only matches `https://`, not `http://`
- Never uses public suffix list naively (prevents eTLD autofill vulnerability)

---

### Autofill Settings

```typescript
import {
  loadAutofillSettings,
  saveAutofillSettings,
  isAutofillEnabledForOrigin,
  includeOrigin,
  excludeOrigin,
} from '@/core/autofill';

// Load user's autofill preferences
const settings = await loadAutofillSettings();
// → { enabled: true, allowedOrigins: ['mybank.co.uk', ...] }

// Enable autofill for a domain
await includeOrigin('mybank.co.uk');

// Check if autofill is enabled for origin
const enabled = isAutofillEnabledForOrigin('https://mybank.co.uk', settings);
// → true/false
```

---

### Extension Bridge

```typescript
import {
  sendMessageToExtension,
  receiveMessageFromExtension,
  registerExtensionBridge,
} from '@/core/autofill';

// Send credential to extension for autofill
await sendMessageToExtension({
  type: 'GET_CREDENTIALS',
  origin: 'https://example.com',
});

// Listen for credential requests from extension
registerExtensionBridge((message, respond) => {
  if (message.type === 'GET_CREDENTIALS') {
    const creds = findMatchingCredentials(message.origin);
    respond(creds);
  }
});
```

---

## Design Notes

### Domain Matching (vs. PSL Vulnerability)

The public suffix list (PSL) is unreliable for security:
- `co.uk` is a "public suffix" → naive implementation treats `mybank.co.uk` and `evil.co.uk` as same domain ❌
- TrustVault uses **dot-boundary matching**: only exact suffixes match
- Example: `mybank.co.uk` matches `mail.mybank.co.uk` but NOT `evil.co.uk`

See `SECURITY.md` for full explanation of eTLD vulnerability and solution.

---

### Opt-In Per-Origin

- Autofill is **disabled by default**
- Users explicitly allow origins in Settings
- Chrome extension respects allow-list: no autofill if origin is disabled

---

## Import Rules

✅ **Can import from:**
- `@/core/utils/`, `@/domain/entities/`

❌ **Cannot import from:**
- `@/data/`, `@/presentation/`

---

## Testing

**Location:** Colocated `.test.ts` files

Example: `src/core/autofill/credentialManagementService.test.ts`

```typescript
test('dot-boundary matching prevents eTLD vulnerability', () => {
  const isMatch = validateDomain('mybank.co.uk', 'evil.co.uk');
  expect(isMatch).toBe(false);
});

test('scheme equality: https only matches https', () => {
  const match = calculateMatchConfidence(
    'https://mybank.co.uk',
    'http://mybank.co.uk'
  );
  expect(match).toBe(0); // No match
});
```

---

## Checklist for New Autofill Code

- [ ] Dot-boundary matching (not PSL-based)
- [ ] Scheme equality enforced
- [ ] Per-origin allow-list respected
- [ ] No credentials logged to console
- [ ] Extension bridge messages validated (Zod)
- [ ] Offline-first: graceful if extension unavailable
- [ ] TypeScript strict mode
- [ ] Test coverage ≥80%
