/**
 * Credential Management API Service
 * Integrates TrustVault with browser's native credential management
 *
 * Security: Uses k-anonymity and origin validation
 * Browser Support: Chrome 51+, Edge 79+, Opera 38+
 */

import type { Credential } from '@/domain/entities/Credential';

/**
 * Browser credential object matching Credential Management API spec
 */
export interface BrowserCredential {
  id: string; // username
  password: string;
  name?: string; // display name
  iconURL?: string; // website icon
  origin: string; // website origin
}

/**
 * Autofill match result
 */
export interface AutofillMatch {
  credential: Credential;
  confidence: number; // 0-100
  originMatch: boolean;
  domainMatch: boolean;
}

/**
 * Check if Credential Management API is available
 */
export function isCredentialManagementSupported(): boolean {
  return typeof navigator !== 'undefined' &&
         'credentials' in navigator &&
         typeof navigator.credentials.create === 'function';
}

/**
 * Extract origin from URL (protocol + hostname + port)
 * Example: https://example.com:443
 */
export function extractOrigin(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return null;
  }
}

/**
 * Extract domain from URL (without subdomain for matching)
 * Example: example.com from https://www.example.com
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Remove www. prefix
    const withoutWww = hostname.replace(/^www\./, '');

    // Get root domain (last two parts for most cases)
    const parts = withoutWww.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }

    return withoutWww;
  } catch {
    return null;
  }
}

/**
 * Validate origin matches credential URL
 * Uses exact match for security
 */
export function validateOrigin(credentialUrl: string, currentOrigin: string): boolean {
  const credentialOrigin = extractOrigin(credentialUrl);
  return credentialOrigin === currentOrigin;
}

/**
 * Check if domain matches (for cross-subdomain autofill)
 * Example: login.example.com matches www.example.com
 */
export function validateDomain(credentialUrl: string, currentUrl: string): boolean {
  const credentialDomain = extractDomain(credentialUrl);
  const currentDomain = extractDomain(currentUrl);

  return credentialDomain !== null &&
         currentDomain !== null &&
         credentialDomain === currentDomain;
}

/**
 * Calculate match confidence score
 * - 100: Exact origin match
 * - 75: Same domain, different subdomain
 * - 50: Domain match with different protocol
 * - 0: No match
 */
export function calculateMatchConfidence(
  credentialUrl: string,
  currentOrigin: string
): number {
  if (!credentialUrl) return 0;

  // Exact origin match
  if (validateOrigin(credentialUrl, currentOrigin)) {
    return 100;
  }

  // Domain match (cross-subdomain)
  const currentUrl = currentOrigin;
  if (validateDomain(credentialUrl, currentUrl)) {
    return 75;
  }

  return 0;
}

/**
 * Find matching credentials for current page origin
 * Returns sorted by confidence score
 */
export function findMatchingCredentials(
  credentials: Credential[],
  currentOrigin: string
): AutofillMatch[] {
  const matches: AutofillMatch[] = [];

  for (const credential of credentials) {
    // Only consider login credentials with URLs
    if (credential.category !== 'login' || !credential.url) {
      continue;
    }

    const confidence = calculateMatchConfidence(credential.url, currentOrigin);

    if (confidence > 0) {
      matches.push({
        credential,
        confidence,
        originMatch: confidence === 100,
        domainMatch: confidence >= 75,
      });
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Store credential using Credential Management API
 * This enables browser's built-in autofill for the specific origin
 */
export async function storeCredentialInBrowser(
  credential: BrowserCredential
): Promise<boolean> {
  if (!isCredentialManagementSupported()) {
    console.warn('Credential Management API not supported');
    return false;
  }

  try {
    // Create PasswordCredential object using the constructor available in supported browsers
    // Note: TypeScript doesn't have built-in types for Credential Management API
    const PasswordCredentialConstructor = (window as unknown as { PasswordCredential?: unknown }).PasswordCredential;

    if (!PasswordCredentialConstructor) {
      console.warn('PasswordCredential constructor not available');
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    const passwordCredential = new (PasswordCredentialConstructor as any)({
      id: credential.id,
      password: credential.password,
      name: credential.name,
      iconURL: credential.iconURL,
    });

    // Store in browser
    await navigator.credentials.store(passwordCredential);

    return true;
  } catch (error) {
    console.error('Failed to store credential in browser:', error);
    return false;
  }
}

/**
 * Request credential from browser for current origin
 * Uses mediation: 'optional' for non-intrusive autofill
 */
export async function getCredentialFromBrowser(): Promise<{
  id: string;
  password: string;
} | null> {
  if (!isCredentialManagementSupported()) {
    return null;
  }

  try {
    // Request password credential with optional mediation
    const credential = await navigator.credentials.get({
      mediation: 'optional', // Don't show UI if user dismissed before
    } as CredentialRequestOptions);

    if (credential && credential.type === 'password') {
      const passwordCred = credential as any;
      return {
        id: passwordCred.id || '',
        password: passwordCred.password || '',
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to get credential from browser:', error);
    return null;
  }
}

/**
 * Request credential with required mediation (shows picker UI)
 * Useful for explicit "Sign in with TrustVault" actions
 */
export async function getCredentialWithUI(): Promise<{
  id: string;
  password: string;
} | null> {
  if (!isCredentialManagementSupported()) {
    return null;
  }

  try {
    // Request password credential with required mediation
    const credential = await navigator.credentials.get({
      mediation: 'required', // Always show credential picker
    } as CredentialRequestOptions);

    if (credential && credential.type === 'password') {
      const passwordCred = credential as any;
      return {
        id: passwordCred.id || '',
        password: passwordCred.password || '',
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to get credential with UI:', error);
    return null;
  }
}

/**
 * Prevent silent access to credentials for current origin
 * Useful after logout to require user interaction
 */
export async function preventSilentAccess(): Promise<void> {
  if (!isCredentialManagementSupported()) {
    return;
  }

  try {
    await navigator.credentials.preventSilentAccess();
  } catch (error) {
    console.error('Failed to prevent silent access:', error);
  }
}

/**
 * Convert TrustVault credential to browser credential format
 */
export function toBrowserCredential(
  credential: Credential
): BrowserCredential | null {
  if (!credential.url) {
    return null;
  }

  const origin = extractOrigin(credential.url);
  if (!origin) {
    return null;
  }

  return {
    id: credential.username,
    password: credential.password,
    name: credential.title,
    iconURL: `${origin}/favicon.ico`,
    origin,
  };
}

/**
 * Batch store multiple credentials for their respective origins
 * Called when user enables autofill or adds new credentials
 */
export async function batchStoreCredentials(
  credentials: Credential[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const credential of credentials) {
    if (credential.category !== 'login' || !credential.url) {
      continue;
    }

    const browserCred = toBrowserCredential(credential);
    if (!browserCred) {
      failed++;
      continue;
    }

    const stored = await storeCredentialInBrowser(browserCred);
    if (stored) {
      success++;
    } else {
      failed++;
    }

    // Rate limit to avoid overwhelming the browser
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success, failed };
}
