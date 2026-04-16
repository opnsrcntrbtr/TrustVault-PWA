/**
 * Breach Detection Type Definitions
 * Interfaces for Have I Been Pwned (HIBP) API integration
 */

/**
 * Breach data from HIBP API
 */
export interface BreachData {
  /** Name identifier of the breach */
  name: string;
  /** Human-readable title of the breach */
  title: string;
  /** Domain of the breached service */
  domain: string;
  /** Date the breach occurred */
  breachDate: string;
  /** Date the breach was added to HIBP */
  addedDate: string;
  /** Date the breach was last modified */
  modifiedDate: string;
  /** Count of breached accounts */
  pwnCount: number;
  /** Description of the breach */
  description: string;
  /** Data classes involved in the breach */
  dataClasses: string[];
  /** Whether the breach is verified */
  isVerified: boolean;
  /** Whether the breach is fabricated */
  isFabricated: boolean;
  /** Whether the breach is sensitive */
  isSensitive: boolean;
  /** Whether the breach is retired */
  isRetired: boolean;
  /** Whether the breach is a spam list */
  isSpamList: boolean;
  /** Logo path for the breach */
  logoPath: string;
}

/**
 * Severity levels for breach results
 */
export type BreachSeverity = 'critical' | 'high' | 'medium' | 'low' | 'safe';

/**
 * Result of a breach check
 */
export interface BreachCheckResult {
  /** Whether the item was found in breaches */
  breached: boolean;
  /** List of breaches found */
  breaches: BreachData[];
  /** Severity level of the breach */
  severity: BreachSeverity;
  /** Timestamp of the check */
  checkedAt: number;
  /** Number of times the password was seen in breaches (for password checks) */
  breachCount?: number;
}

/**
 * Stored breach result in IndexedDB
 */
export interface StoredBreachResult {
  /** Unique identifier */
  id: string;
  /** Credential ID this breach result is associated with */
  credentialId: string;
  /** Type of check performed */
  checkType: 'password' | 'email';
  /** Whether the item was found in breaches */
  breached: boolean;
  /** Number of breaches found */
  breachCount: number;
  /** Severity level */
  severity: BreachSeverity;
  /** List of breach names */
  breachNames: string[];
  /** Full breach data (optional, for detailed view) */
  breachData?: BreachData[];
  /** Timestamp when the check was performed */
  checkedAt: number;
  /** Cache expiry timestamp (24 hours from checkedAt) */
  expiresAt: number;
}

/**
 * Options for breach checking
 */
export interface BreachCheckOptions {
  /** Force refresh even if cache is valid */
  forceRefresh?: boolean;
  /** Include unverified breaches */
  includeUnverified?: boolean;
  /** Truncate response to just breach names */
  truncateResponse?: boolean;
}

/**
 * HIBP API error response
 */
export interface HibpError {
  statusCode: number;
  message: string;
}

/**
 * Rate limit state for HIBP API
 */
export interface RateLimitState {
  /** Last request timestamp */
  lastRequestAt: number;
  /** Number of requests in current window */
  requestCount: number;
  /** When the current rate limit window resets */
  windowResetAt: number;
}
