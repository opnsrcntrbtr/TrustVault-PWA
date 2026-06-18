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
// Vite ?raw import — the ESLint project service can't resolve vite/client's
// `*?raw` module typing, so assert the documented type (string) explicitly.
import indexHtmlRaw from '../../../index.html?raw';

const indexHtml = indexHtmlRaw as string;
import {
  buildContentSecurityPolicy,
  SECURITY_HEADERS,
  DEV_SECURITY_HEADERS,
  HIBP_ORIGINS,
  INLINE_BOOTSTRAP_SCRIPT_HASH,
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

  it('uses a strict script-src: no unsafe-inline/unsafe-eval, hash + wasm-unsafe-eval (S2)', () => {
    const scriptSrc = csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).toContain(`'${INLINE_BOOTSTRAP_SCRIPT_HASH}'`);
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
  });

  it('allows no third-party script or connect origins beyond HIBP', () => {
    expect(csp).not.toContain('cdn.jsdelivr.net');
  });
});

describe('Inline bootstrap script hash (S2 drift guard)', () => {
  it('matches the SHA-256 of the single inline script in index.html', async () => {
    const inlineScripts = [
      ...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ];

    // Exactly one inline script may exist — every additional one would need
    // its own hash in the CSP and silently breaks under the strict policy.
    expect(inlineScripts).toHaveLength(1);

    const body = inlineScripts[0]?.[1] ?? '';
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body),
    );
    const hash = `sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
    expect(hash).toBe(INLINE_BOOTSTRAP_SCRIPT_HASH);
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

describe('Dev-only header variant (never ships)', () => {
  it('differs from production headers ONLY in the CSP script-src directive', () => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (key === 'Content-Security-Policy') continue;
      expect(DEV_SECURITY_HEADERS[key]).toBe(value);
    }
    const stripScriptSrc = (csp: string | undefined): string =>
      (csp ?? '').replace(/script-src [^;]+/, 'script-src <normalized>');
    expect(stripScriptSrc(DEV_SECURITY_HEADERS['Content-Security-Policy'])).toBe(
      stripScriptSrc(SECURITY_HEADERS['Content-Security-Policy'])
    );
  });

  it('production headers stay strict regardless of the dev variant', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).not.toContain("'unsafe-inline' 'wasm-unsafe-eval'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain(INLINE_BOOTSTRAP_SCRIPT_HASH);
  });
});

describe('vercel.json parity (drift guard)', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const vercelContent: string = readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf-8');
  const vercel = JSON.parse(vercelContent) as {
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
