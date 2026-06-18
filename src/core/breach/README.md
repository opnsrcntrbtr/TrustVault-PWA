# Core: Breach Detection (`src/core/breach/`)

## Purpose

Provides Have I Been Pwned (HIBP) integration using **k-anonymity** for zero-knowledge password breach checking:
- Fetch SHA-1 prefix ranges from HIBP without disclosing full hashes
- Cache breach prefixes in IndexedDB (`breachPrefixes` table, DB v8)
- Check passwords against cached prefixes offline
- Periodic background sync (P4) via Service Worker

## Public API

### Check Password Breach

```typescript
import { checkPasswordBreach, checkPasswordWithCache } from '@/core/breach';

// Real-time check (5-char prefix, k-anonymity)
const result = await checkPasswordBreach(password);
// → { isBreached: true/false, count: number, severity: 'critical'|'high'|'medium'|'low' }

// Offline check (uses cached prefixes)
const cached = await checkPasswordWithCache(password);
// → same format as above
```

**Invariants:**
- Only 5-char SHA-1 prefixes sent to HIBP (k-anonymity: ~5,000 false positives/hash)
- Full hash never transmitted
- Caching strategy: `CacheFirst` with 7-day staleness re-validation on unlock

---

### HIBP Service

```typescript
import { getRangeResponse, parseRangeResponse } from '@/core/breach';

// Fetch prefix range from HIBP
const response = await getRangeResponse(sha1Prefix); // e.g., "ABC12"
// → "count:breachCount\ncount:breachCount\n..."

// Parse HIBP response
const suffix = parseRangeResponse(response, fullHash);
// → count if found, null if not breached
```

---

### Breach Prefix Cache

```typescript
import { computeSha1Prefix, saveBreachPrefix, getAllBreachPrefixes } from '@/core/breach';

// Compute 5-char SHA-1 prefix (k-anonymity)
const prefix = computeSha1Prefix(password);

// Store in IndexedDB for offline checks
await saveBreachPrefix(prefix);

// Retrieve cached prefixes
const allPrefixes = await getAllBreachPrefixes();
```

---

## Design Notes

### Why k-Anonymity?

- **Privacy:** Full password hash never sent to HIBP
- **Efficiency:** One request returns ~5,000 hashes; search locally
- **Disclosed:** This approach is documented in `SECURITY.md` (residual risk acknowledged)

### Periodic Sync (P4)

- Service Worker fetches prefix ranges while vault is locked
- `public/sw-periodic-sync.js` uses workbox `importScripts`
- Prefetches into `hibp-ranges` cache for fast checks on unlock
- See `rangeCache.ts` for cache-first strategy

---

## Import Rules

✅ **Can import from:**
- `@/core/crypto/` — hash functions
- `@/core/utils/` — base64

❌ **Cannot import from:**
- `@/data/`, `@/presentation/`

---

## Testing

**Location:** Colocated `.test.ts` files

Example: `src/core/breach/hibpService.test.ts`

```typescript
test('k-anonymity: only 5-char prefix sent to HIBP', async () => {
  const fullHash = 'ABC12345...';
  const prefix = computeSha1Prefix(fullHash);
  expect(prefix).toHaveLength(5);
  // Verify full hash never appears in request
});
```

---

## Checklist for New Breach Code

- [ ] k-Anonymity: only 5-char prefixes exposed
- [ ] Offline-first: graceful fallback if network unavailable
- [ ] Cache staleness: 7-day TTL with unlock re-validation
- [ ] No full hashes logged to console
- [ ] TypeScript strict mode
- [ ] Test coverage ≥80%
