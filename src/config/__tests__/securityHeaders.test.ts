/**
 * Tests for the canonical security-header source of truth.
 *
 * These guard the findings from SECURITY_PWA_ENHANCEMENT_PLAN.md:
 *  - S3: connect-src must allow the HIBP endpoints the breach feature calls.
 *  - S2 (partial): CSP must include object-src/base-uri/frame-ancestors/form-action.
 *  - S6: HSTS + cross-origin isolation headers must be present.
 *  - Drift guard: the static vercel.json must match the canonical policy
 *    (this is the exact class of bug that left the deployed CSP out of sync
 *    with the audit and broke breach detection).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buildContentSecurityPolicy,
  SECURITY_HEADERS,
  HIBP_ORIGINS,
} from '../securityHeaders';

describe('Content Security Policy', () => {
  const csp = buildContentSecurityPolicy();

  it('allows the HIBP breach-detection endpoints in connect-src (S3)', () => {
    const connectSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toBeDefined();
    for (const origin of HIBP_ORIGINS) {
      expect(connectSrc).toContain(origin);
    }
  });

  it('includes clickjacking/injection hardening directives (S2)', () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('keeps default-src locked to self', () => {
    expect(csp).toMatch(/default-src 'self'/);
  });
});

describe('Security headers (S6)', () => {
  it('enforces HSTS with a 2-year max-age and includeSubDomains', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('includeSubDomains');
    const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? '')?.[1] ?? '0');
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  it('sets cross-origin isolation headers', () => {
    expect(SECURITY_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(SECURITY_HEADERS['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });

  it('retains the existing baseline headers', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});

describe('vercel.json parity (drift guard)', () => {
  const vercel = JSON.parse(
    readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf-8')
  ) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };

  const globalRule = vercel.headers.find((h) => h.source === '/(.*)');

  it('applies the global header rule to all routes', () => {
    expect(globalRule).toBeDefined();
  });

  it('ships the exact canonical CSP', () => {
    const deployedCsp = globalRule?.headers.find(
      (h) => h.key === 'Content-Security-Policy'
    )?.value;
    expect(deployedCsp).toBe(buildContentSecurityPolicy());
  });

  it('ships every canonical security header verbatim', () => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      const deployed = globalRule?.headers.find((h) => h.key === key)?.value;
      expect(deployed, `vercel.json missing/incorrect header: ${key}`).toBe(value);
    }
  });
});
