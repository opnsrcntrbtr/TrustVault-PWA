/**
 * Breach Results Repository
 * Manages persistent storage of breach check results in IndexedDB
 */

import { db, type StoredBreachResult } from '@/data/storage/database';
import type { BreachCheckResult, BreachData, BreachSeverity } from '@/core/breach/breachTypes';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Saves a breach check result to the database
 */
export async function saveBreachResult(
  credentialId: string,
  checkType: 'password' | 'email',
  result: BreachCheckResult
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + CACHE_DURATION;

  const storedResult: StoredBreachResult = {
    id: `${credentialId}-${checkType}-${now}`,
    credentialId,
    checkType,
    breached: result.breached,
    breachCount: result.breachCount || result.breaches.length,
    severity: result.severity,
    breachNames: result.breaches.map(b => b.name),
    breachData: result.breaches.length > 0 ? JSON.stringify(result.breaches) : '',
    checkedAt: result.checkedAt,
    expiresAt,
  };

  await db.breachResults.put(storedResult);
}

/**
 * Gets the latest breach result for a credential
 */
export async function getBreachResult(
  credentialId: string,
  checkType: 'password' | 'email'
): Promise<BreachCheckResult | null> {
  const results = await db.breachResults
    .where('credentialId')
    .equals(credentialId)
    .and(r => r.checkType === checkType)
    .reverse()
    .sortBy('checkedAt');

  if (results.length === 0) {
    return null;
  }

  const latest = results[0];
  if (!latest) {
    return null;
  }

  // Check if expired
  if (Date.now() >= latest.expiresAt) {
    // Expired - remove it and return null
    await db.breachResults.delete(latest.id);
    return null;
  }

  // Convert stored result back to BreachCheckResult
  return {
    breached: latest.breached,
    breaches: latest.breachData && latest.breachData.length > 0 ? JSON.parse(latest.breachData) as BreachData[] : [],
    severity: latest.severity,
    checkedAt: latest.checkedAt,
    breachCount: latest.breachCount,
  };
}

/**
 * Gets all breach results for a credential (password and email)
 */
export async function getAllBreachResultsForCredential(
  credentialId: string
): Promise<{
  password: BreachCheckResult | null;
  email: BreachCheckResult | null;
}> {
  const [password, email] = await Promise.all([
    getBreachResult(credentialId, 'password'),
    getBreachResult(credentialId, 'email'),
  ]);

  return { password, email };
}

/**
 * Gets all breached credentials with their results
 */
export async function getAllBreachedCredentials(): Promise<
  Array<{
    credentialId: string;
    checkType: 'password' | 'email';
    severity: BreachSeverity;
    breachCount: number;
    breachNames: string[];
    checkedAt: number;
  }>
> {
  const results = await db.breachResults
    .where('breached')
    .equals(1) // IndexedDB stores boolean as 1/0
    .toArray();

  // Filter out expired results
  const now = Date.now();
  const validResults = results.filter(r => now < r.expiresAt);

  // Remove expired results
  const expiredIds = results.filter(r => now >= r.expiresAt).map(r => r.id);
  if (expiredIds.length > 0) {
    await db.breachResults.bulkDelete(expiredIds);
  }

  // Group by credential and get the latest result for each
  const grouped = new Map<string, StoredBreachResult>();

  for (const result of validResults) {
    const key = `${result.credentialId}-${result.checkType}`;
    const existing = grouped.get(key);

    if (!existing || result.checkedAt > existing.checkedAt) {
      grouped.set(key, result);
    }
  }

  return Array.from(grouped.values()).map(r => ({
    credentialId: r.credentialId,
    checkType: r.checkType,
    severity: r.severity,
    breachCount: r.breachCount,
    breachNames: r.breachNames,
    checkedAt: r.checkedAt,
  }));
}

/**
 * Gets breach statistics
 */
export async function getBreachStatistics(): Promise<{
  total: number;
  breached: number;
  safe: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number;
  };
}> {
  const allResults = await db.breachResults.toArray();

  // Filter out expired
  const now = Date.now();
  const validResults = allResults.filter(r => now < r.expiresAt);

  // Group by credential to avoid counting duplicates
  const latestByCredential = new Map<string, StoredBreachResult>();

  for (const result of validResults) {
    const key = `${result.credentialId}-${result.checkType}`;
    const existing = latestByCredential.get(key);

    if (!existing || result.checkedAt > existing.checkedAt) {
      latestByCredential.set(key, result);
    }
  }

  const results = Array.from(latestByCredential.values());

  const breached = results.filter(r => r.breached).length;
  const safe = results.filter(r => !r.breached).length;

  const bySeverity = {
    critical: results.filter(r => r.severity === 'critical').length,
    high: results.filter(r => r.severity === 'high').length,
    medium: results.filter(r => r.severity === 'medium').length,
    low: results.filter(r => r.severity === 'low').length,
    safe: results.filter(r => r.severity === 'safe').length,
  };

  return {
    total: results.length,
    breached,
    safe,
    bySeverity,
  };
}

/**
 * Deletes all breach results for a credential
 */
export async function deleteBreachResults(credentialId: string): Promise<void> {
  const results = await db.breachResults.where('credentialId').equals(credentialId).toArray();
  const ids = results.map(r => r.id);

  if (ids.length > 0) {
    await db.breachResults.bulkDelete(ids);
  }
}

/**
 * Cleans up expired breach results
 */
export async function cleanupExpiredResults(): Promise<number> {
  const now = Date.now();
  const expired = await db.breachResults.where('expiresAt').below(now).toArray();

  if (expired.length > 0) {
    const ids = expired.map(r => r.id);
    await db.breachResults.bulkDelete(ids);
  }

  return expired.length;
}

/**
 * Clears all breach results (for testing or reset)
 */
export async function clearAllBreachResults(): Promise<void> {
  await db.breachResults.clear();
}
