/**
 * Have I Been Pwned (HIBP) API Service
 * Implements secure breach detection using k-anonymity for passwords
 * and direct email breach checking
 *
 * HIBP API Documentation: https://haveibeenpwned.com/API/v3
 */

import { sha1 } from '@noble/hashes/sha1';
import { bytesToHex } from '@noble/hashes/utils';
import type {
  BreachData,
  BreachCheckResult,
  BreachCheckOptions,
  BreachSeverity,
  RateLimitState,
} from './breachTypes';

// HIBP API Configuration
const HIBP_API_BASE = 'https://api.pwnedpasswords.com';
const HIBP_BREACH_API_BASE = 'https://haveibeenpwned.com/api/v3';
const RATE_LIMIT_DELAY = 1500; // 1500ms between requests per HIBP guidelines
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Rate limiting state
 */
const rateLimitState: RateLimitState = {
  lastRequestAt: 0,
  requestCount: 0,
  windowResetAt: Date.now() + 60000, // 1 minute window
};

/**
 * In-memory cache for breach results
 */
const breachCache = new Map<string, { result: BreachCheckResult; expiresAt: number }>();

/**
 * Enforces rate limiting with exponential backoff
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - rateLimitState.lastRequestAt;

  // Reset window if expired
  if (now >= rateLimitState.windowResetAt) {
    rateLimitState.requestCount = 0;
    rateLimitState.windowResetAt = now + 60000;
  }

  // Wait if needed
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  rateLimitState.lastRequestAt = Date.now();
  rateLimitState.requestCount++;
}

/**
 * Handles API errors with retry logic
 */
async function handleApiError(response: Response, retryCount = 0): Promise<never> {
  const maxRetries = 3;

  if (response.status === 429) {
    // Rate limited - use exponential backoff
    if (retryCount < maxRetries) {
      const backoffDelay = RATE_LIMIT_DELAY * Math.pow(2, retryCount);
      console.warn(`Rate limited, retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      throw new Error('RETRY'); // Signal to retry
    }
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  if (response.status === 404) {
    // No breaches found - this is actually a success case
    throw new Error('NOT_FOUND');
  }

  if (response.status === 503) {
    throw new Error('Service temporarily unavailable. Please try again later.');
  }

  throw new Error(`API error: ${response.status} ${response.statusText}`);
}

/**
 * Computes SHA-1 hash of a password for k-anonymity checking
 * @param password - The password to hash
 * @returns Uppercase hexadecimal SHA-1 hash
 */
function hashPassword(password: string): string {
  const passwordBytes = new TextEncoder().encode(password);
  const hashBytes = sha1(passwordBytes);
  return bytesToHex(hashBytes).toUpperCase();
}

/**
 * Checks if a password has been breached using k-anonymity
 * Only sends first 5 characters of SHA-1 hash to HIBP API
 *
 * @param password - The password to check
 * @param options - Check options
 * @returns Breach check result with count of breaches
 */
export async function checkPasswordBreach(
  password: string,
  options: BreachCheckOptions = {}
): Promise<BreachCheckResult> {
  try {
    // Check cache first
    const cacheKey = `password:${password}`;
    const cached = breachCache.get(cacheKey);

    if (cached && !options.forceRefresh && Date.now() < cached.expiresAt) {
      console.log('Returning cached breach result');
      return cached.result;
    }

    // Hash the password
    const hash = hashPassword(password);
    const hashPrefix = hash.substring(0, 5);
    const hashSuffix = hash.substring(5);

    // Enforce rate limiting
    await enforceRateLimit();

    // Query HIBP API with hash prefix (k-anonymity)
    const userAgent = import.meta.env.VITE_HIBP_USER_AGENT;
    const response = await fetch(`${HIBP_API_BASE}/range/${hashPrefix}`, {
      headers: {
        'User-Agent': userAgent || 'TrustVault-PWA',
        'Add-Padding': 'true', // Request padding for additional privacy
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Password not found in breaches - this is good!
        const result: BreachCheckResult = {
          breached: false,
          breaches: [],
          severity: 'safe',
          checkedAt: Date.now(),
          breachCount: 0,
        };

        // Cache the result
        breachCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + CACHE_DURATION,
        });

        return result;
      }

      await handleApiError(response);
    }

    // Parse response - format is "SUFFIX:COUNT\r\n"
    const text = await response.text();
    const lines = text.split('\n');

    let breachCount = 0;
    for (const line of lines) {
      const parts = line.trim().split(':');
      const suffix = parts[0];
      const count = parts[1];
      if (suffix === hashSuffix && count) {
        breachCount = parseInt(count, 10);
        break;
      }
    }

    // Determine severity based on breach count
    let severity: BreachSeverity;
    if (breachCount === 0) {
      severity = 'safe';
    } else if (breachCount >= 10000) {
      severity = 'critical';
    } else if (breachCount >= 1000) {
      severity = 'high';
    } else if (breachCount >= 100) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    const result: BreachCheckResult = {
      breached: breachCount > 0,
      breaches: [], // Password API doesn't return breach details
      severity,
      checkedAt: Date.now(),
      breachCount,
    };

    // Cache the result
    breachCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_DURATION,
    });

    return result;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        const result: BreachCheckResult = {
          breached: false,
          breaches: [],
          severity: 'safe',
          checkedAt: Date.now(),
          breachCount: 0,
        };
        return result;
      }

      if (error.message === 'RETRY') {
        // Retry the request
        return checkPasswordBreach(password, options);
      }
    }

    console.error('Password breach check failed:', error);
    throw error;
  }
}

/**
 * Checks if an email has been involved in data breaches
 *
 * @param email - The email address to check
 * @param options - Check options
 * @returns Breach check result with breach details
 */
export async function checkEmailBreach(
  email: string,
  options: BreachCheckOptions = {}
): Promise<BreachCheckResult> {
  try {
    // Check cache first
    const cacheKey = `email:${email.toLowerCase()}`;
    const cached = breachCache.get(cacheKey);

    if (cached && !options.forceRefresh && Date.now() < cached.expiresAt) {
      console.log('Returning cached email breach result');
      return cached.result;
    }

    // Enforce rate limiting
    await enforceRateLimit();

    // Query HIBP API for email breaches
    const params = new URLSearchParams({
      truncateResponse: options.truncateResponse ? 'true' : 'false',
    });

    // Note: Email breach checking requires an API key for production use
    // For now, we'll implement password-only checking
    // In production, set VITE_HIBP_API_KEY environment variable
    const apiKey = import.meta.env.VITE_HIBP_API_KEY;

    if (!apiKey) {
      console.warn('HIBP API key not configured. Email breach checking disabled.');
      return {
        breached: false,
        breaches: [],
        severity: 'safe',
        checkedAt: Date.now(),
      };
    }

    const userAgent = import.meta.env.VITE_HIBP_USER_AGENT;
    const response = await fetch(
      `${HIBP_BREACH_API_BASE}/breachedaccount/${encodeURIComponent(email)}?${params}`,
      {
        headers: {
          'hibp-api-key': apiKey,
          'User-Agent': userAgent || 'TrustVault-PWA',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Email not found in breaches - this is good!
        const result: BreachCheckResult = {
          breached: false,
          breaches: [],
          severity: 'safe',
          checkedAt: Date.now(),
        };

        breachCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + CACHE_DURATION,
        });

        return result;
      }

      await handleApiError(response);
    }

    const breaches: BreachData[] = await response.json();

    // Filter out unverified breaches if requested
    const filteredBreaches = options.includeUnverified
      ? breaches
      : breaches.filter(b => b.isVerified);

    // Determine severity based on breach count and recency
    let severity: BreachSeverity = 'safe';
    if (filteredBreaches.length > 0) {
      const recentBreaches = filteredBreaches.filter(b => {
        const breachDate = new Date(b.breachDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return breachDate > oneYearAgo;
      });

      if (recentBreaches.length > 0) {
        severity = 'critical';
      } else if (filteredBreaches.length >= 5) {
        severity = 'high';
      } else if (filteredBreaches.length >= 3) {
        severity = 'medium';
      } else {
        severity = 'low';
      }
    }

    const result: BreachCheckResult = {
      breached: filteredBreaches.length > 0,
      breaches: filteredBreaches,
      severity,
      checkedAt: Date.now(),
    };

    breachCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + CACHE_DURATION,
    });

    return result;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        const result: BreachCheckResult = {
          breached: false,
          breaches: [],
          severity: 'safe',
          checkedAt: Date.now(),
        };
        return result;
      }

      if (error.message === 'RETRY') {
        return checkEmailBreach(email, options);
      }
    }

    console.error('Email breach check failed:', error);
    throw error;
  }
}

/**
 * Clears the breach check cache
 */
export function clearBreachCache(): void {
  breachCache.clear();
  console.log('Breach cache cleared');
}

/**
 * Gets cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; expiresAt: number }>;
} {
  const entries = Array.from(breachCache.entries()).map(([key, value]) => ({
    key,
    expiresAt: value.expiresAt,
  }));

  return {
    size: breachCache.size,
    entries,
  };
}

/**
 * Cleans up expired cache entries
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, value] of breachCache.entries()) {
    if (now >= value.expiresAt) {
      breachCache.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} expired cache entries`);
  }
}

/**
 * Checks if HIBP service is enabled
 */
export function isHibpEnabled(): boolean {
  const enabled = import.meta.env.VITE_HIBP_API_ENABLED;
  return enabled === 'true' || enabled === true;
}
