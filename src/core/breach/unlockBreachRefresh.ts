/**
 * On-Unlock Breach Refresh (P4 — background breach re-checks)
 *
 * Works in every browser: after unlock, if the last full check is older than
 * 7 days, re-check each credential against HIBP via the cache-first range
 * lookup (instant + offline when the periodic-sync worker prefetched the
 * ranges, network fallback otherwise). Results land in the existing
 * breachResults store so the Security Audit dashboard picks them up.
 *
 * Also registers the Periodic Background Sync task on Chromium installed
 * PWAs; silently a no-op everywhere else.
 */

import type { Credential } from '@/domain/entities/Credential';
import { isHibpEnabled } from './hibpService';
import { checkPasswordWithCache } from './rangeCache';
import { saveBreachPrefix } from './breachPrefixStore';
import { saveBreachResult } from '@/data/repositories/breachResultsRepository';

export const LAST_FULL_CHECK_KEY = 'tv_hibp_last_full_check';
export const FULL_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const PERIODIC_SYNC_TAG = 'hibp-refresh';

/**
 * True when no full check has run within FULL_CHECK_INTERVAL_MS.
 * The timestamp is a non-sensitive scalar, so localStorage is fine.
 */
export function isBreachCheckStale(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(LAST_FULL_CHECK_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    if (Number.isNaN(last)) return true;
    return now - last >= FULL_CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

export function markBreachCheckComplete(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_FULL_CHECK_KEY, String(now));
  } catch {
    // localStorage unavailable — next unlock simply re-checks.
  }
}

export function getLastFullCheckAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_FULL_CHECK_KEY);
    if (!raw) return null;
    const last = parseInt(raw, 10);
    return Number.isNaN(last) ? null : last;
  } catch {
    return null;
  }
}

/**
 * Registers the HIBP periodic background sync task. Feature-detected:
 * requires a service worker registration with periodicSync (Chromium,
 * installed PWA) and a granted 'periodic-background-sync' permission.
 * Returns true when registered.
 */
export async function registerHibpPeriodicSync(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    if (!('periodicSync' in registration)) return false;

    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });
    if (status.state !== 'granted') return false;

    const periodicSync = (registration as ServiceWorkerRegistration & {
      periodicSync: { register(tag: string, options: { minInterval: number }): Promise<void> };
    }).periodicSync;
    await periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: FULL_CHECK_INTERVAL_MS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs the post-unlock breach refresh when stale. Backfills prefix rows for
 * pre-v8 credentials as a side effect (the migration cannot compute them).
 * Fire-and-forget: callers must not block unlock on this.
 */
export async function runUnlockBreachRefresh(credentials: Credential[]): Promise<void> {
  if (!isHibpEnabled()) return;

  // Always try to (re)register periodic sync — registration is idempotent.
  void registerHibpPeriodicSync();

  if (!isBreachCheckStale() || credentials.length === 0) return;

  let anyChecked = false;
  for (const credential of credentials) {
    const password = credential.password;
    if (!password || password.trim() === '' || password === '[Decryption Failed]') continue;

    // Lazy backfill so the periodic-sync worker knows this prefix next cycle.
    await saveBreachPrefix(credential.id, password);

    try {
      const result = await checkPasswordWithCache(password);
      await saveBreachResult(credential.id, 'password', result);
      anyChecked = true;
    } catch {
      // Offline with no prefetched range — skip; next unlock retries.
    }
  }

  if (anyChecked) {
    markBreachCheckComplete();
  }
}
