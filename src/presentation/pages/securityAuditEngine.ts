/**
 * Security Audit Engine — pure, testable module
 *
 * Extracted from SecurityAuditPage to enable TDD without DOM/jsdom.
 * All rules are synchronous; breach data is pre-loaded by the caller.
 */

import type { BreachCheckResult, BreachSeverity } from '@/core/breach/breachTypes';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SecurityIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'weak' | 'reused' | 'old' | 'no-password' | 'breached';
  credentialTitle: string;
  credentialId?: string;
  details: string;
  breachData?: BreachCheckResult;
}

export interface BuildIssuesOptions {
  now?: number; // timestamp for deterministic testing
}

export interface IssuesByType {
  breached: number;
  'no-password': number;
  weak: number;
  reused: number;
  old: number;
}

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Build security issues from credentials and pre-loaded breach data.
 * Rules (in priority order per credential):
 *   1. Breached (highest)
 *   2. No password
 *   3. Weak (<60, <40 = critical)
 *   4. Old (>365, >730 = high)
 *   5. Reused (aggregated across all credentials)
 */
export function buildSecurityIssues(
  credentials: Array<{
    id: string;
    title: string;
    password?: string;
    securityScore?: number | undefined;
    updatedAt?: Date;
  }>,
  breachedCredentials: Array<{
    credentialId: string;
    checkType: 'password' | 'email';
    severity: string;
    breachCount: number;
    breachNames: string[];
    checkedAt: number;
  }>,
  opts: BuildIssuesOptions = {},
): SecurityIssue[] {
  const now = opts.now ?? Date.now();
  const foundIssues: SecurityIssue[] = [];
  const passwordMap = new Map<string, string[]>();

  for (const cred of credentials) {
    // 1. Breach check (highest priority)
    const breach = breachedCredentials.find(
      b => b.credentialId === cred.id && b.checkType === 'password',
    );
    if (breach) {
      const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        low: 'low',
      };
      foundIssues.push({
        id: `${cred.id}-breached`,
        title: 'Password Found in Data Breach',
        severity: severityMap[breach.severity] || 'critical',
        type: 'breached',
        credentialTitle: cred.title,
        credentialId: cred.id,
        details: `This password has been seen ${String(breach.breachCount).toLocaleString()} time${breach.breachCount === 1 ? '' : 's'} in data breaches. Change it immediately!`,
        breachData: {
          breached: true,
          breaches: [],
          severity: breach.severity as BreachSeverity,
          checkedAt: breach.checkedAt,
          breachCount: breach.breachCount,
        },
      });
    }

    // 2. No password check
    if (!cred.password || cred.password.trim() === '') {
      foundIssues.push({
        id: `${cred.id}-no-password`,
        title: 'Missing Password',
        severity: 'medium',
        type: 'no-password',
        credentialTitle: cred.title,
        credentialId: cred.id,
        details: 'This credential has no password set.',
      });
      continue; // skip further checks for this credential
    }

    // 3. Weak password check
    const score = cred.securityScore ?? 0;
    if (score < 60) {
      foundIssues.push({
        id: `${cred.id}-weak`,
        title: 'Weak Password',
        severity: score < 40 ? 'critical' : 'high',
        type: 'weak',
        credentialTitle: cred.title,
        credentialId: cred.id,
        details: `Password strength: ${String(score)}/100. Consider using a longer, more complex password.`,
      });
    }

    // 4. Track for reuse detection
    if (passwordMap.has(cred.password)) {
      const titles = passwordMap.get(cred.password);
      if (titles) titles.push(cred.title);
    } else {
      passwordMap.set(cred.password, [cred.title]);
    }

    // 5. Old password check
    if (cred.updatedAt) {
      const daysSinceUpdate = Math.floor(
        (now - cred.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceUpdate > 365) {
        foundIssues.push({
          id: `${cred.id}-old`,
          title: 'Password Not Updated',
          severity: daysSinceUpdate > 730 ? 'high' : 'medium',
          type: 'old',
          credentialTitle: cred.title,
          credentialId: cred.id,
          details: `Password is ${String(daysSinceUpdate)} days old. Consider updating for better security.`,
        });
      }
    }
  }

  // 6. Reused password check (aggregated)
  passwordMap.forEach((titles, _password) => {
    if (titles.length > 1) {
      foundIssues.push({
        id: `reused-${_password.substring(0, 8)}`,
        title: 'Reused Password',
        severity: 'high',
        type: 'reused',
        credentialTitle: titles.join(', '),
        details: `This password is used on ${String(titles.length)} accounts: ${titles.join(', ')}`,
      });
    }
  });

  return foundIssues;
}

/**
 * Compute overall security score as plain average of credential scores.
 */
export function computeSecurityScore(
  credentials: Array<{ securityScore?: number | undefined }>,
): number {
  const count = credentials.length;
  if (count === 0) return 0;
  const sum = credentials.reduce(
    (s, c) => s + (c.securityScore ?? 0),
    0,
  );
  return Math.round(sum / count);
}

/**
 * Count issues by type. Returns zeroed shape for all known types.
 */
export function countIssuesByType(issues: SecurityIssue[]): IssuesByType {
  const counts: IssuesByType = {
    breached: 0,
    'no-password': 0,
    weak: 0,
    reused: 0,
    old: 0,
  };
  for (const issue of issues) {
    counts[issue.type]++;
  }
  return counts;
}

/**
 * Format age in days with singular/plural.
 */
export function formatAgeDays(updatedAt: Date, now: number): string {
  const days = Math.floor((now - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  return days === 1 ? '1 day' : `${String(days)} days`;
}

// ── Score/label helpers ──────────────────────────────────────────────────────

/**
 * Map score to MUI color name.
 */
export function getScoreColor(score: number): 'success' | 'info' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'info';
  if (score >= 40) return 'warning';
  return 'error';
}

/**
 * Map score to human-readable label.
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

/**
 * Map severity to MUI color name.
 */
export function getSeverityColor(severity: string): 'error' | 'warning' | 'info' | 'default' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Map severity to MUI icon component.
 * NOTE: Icon JSX stays in the page component; this helper returns a
 * string identifier that the page maps to its icon imports.
 */
export function getSeverityIcon(severity: string): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'info';
  }
}
