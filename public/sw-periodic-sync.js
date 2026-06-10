/**
 * HIBP Periodic Background Sync (P4)
 *
 * Imported into the generated Workbox service worker via the workbox
 * `importScripts` option (vite.config.ts). On the 'hibp-refresh' periodic
 * sync event it reads the stored 5-char SHA-1 prefixes from IndexedDB and
 * prefetches the corresponding HIBP k-anonymity range responses into the
 * 'hibp-ranges' Cache Storage bucket. The vault stays locked: prefixes alone
 * are fetched (the exact strings already disclosed to HIBP by design) and the
 * actual suffix comparison happens in the app after unlock.
 *
 * Cache name, freshness header, and TTL MUST stay in sync with
 * src/core/breach/rangeCache.ts.
 */

const HIBP_RANGE_CACHE = 'hibp-ranges';
const FETCHED_AT_HEADER = 'x-tv-fetched-at';
const RANGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const HIBP_API_BASE = 'https://api.pwnedpasswords.com';
const REQUEST_SPACING_MS = 1500; // HIBP rate-limit etiquette

const DB_NAME = 'TrustVaultDB';
const PREFIX_STORE = 'breachPrefixes';

/** Reads all stored SHA-1 prefixes via raw IndexedDB (no Dexie in the SW). */
function readPrefixes() {
  return new Promise((resolve) => {
    // Open without a version: never trigger an upgrade from the SW.
    const open = indexedDB.open(DB_NAME);
    open.onerror = () => resolve([]);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(PREFIX_STORE)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(PREFIX_STORE, 'readonly');
      const req = tx.objectStore(PREFIX_STORE).getAll();
      req.onerror = () => { db.close(); resolve([]); };
      req.onsuccess = () => {
        const prefixes = (req.result || [])
          .map((row) => row && row.sha1Prefix)
          .filter((p) => typeof p === 'string' && /^[0-9A-F]{5}$/.test(p));
        db.close();
        resolve(Array.from(new Set(prefixes)));
      };
    };
  });
}

function isFresh(response) {
  const header = response.headers.get(FETCHED_AT_HEADER);
  if (!header) return false;
  const fetchedAt = parseInt(header, 10);
  return !Number.isNaN(fetchedAt) && Date.now() - fetchedAt < RANGE_TTL_MS;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Prefetches every stored prefix's range response into the cache. */
async function refreshHibpRanges() {
  const prefixes = await readPrefixes();
  if (prefixes.length === 0) return;

  const cache = await caches.open(HIBP_RANGE_CACHE);

  for (let i = 0; i < prefixes.length; i++) {
    const url = `${HIBP_API_BASE}/range/${prefixes[i]}`;

    const cached = await cache.match(url);
    if (cached && isFresh(cached)) continue;

    try {
      const response = await fetch(url, {
        headers: { 'Add-Padding': 'true' },
      });
      if (response.ok) {
        const text = await response.text();
        await cache.put(
          url,
          new Response(text, {
            headers: {
              'Content-Type': 'text/plain',
              [FETCHED_AT_HEADER]: String(Date.now()),
            },
          })
        );
      }
    } catch {
      // Network unavailable — leave any stale entry in place and move on.
    }

    if (i < prefixes.length - 1) await sleep(REQUEST_SPACING_MS);
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hibp-refresh') {
    event.waitUntil(refreshHibpRanges());
  }
});
