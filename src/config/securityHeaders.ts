/**
 * Canonical security-header source of truth.
 *
 * Both the Vite dev/preview servers (vite.config.ts) and the production
 * Vercel deployment (vercel.json) MUST serve exactly these headers. A parity
 * test (src/config/__tests__/securityHeaders.test.ts) fails the build if
 * vercel.json drifts from this file — preventing the class of bug where the
 * documented policy and the deployed policy diverge.
 *
 * See SECURITY_PWA_ENHANCEMENT_PLAN.md (S2, S3, S6) for rationale.
 */

/** Origins the breach-detection feature (hibpService.ts) calls. */
export const HIBP_ORIGINS = [
  'https://api.pwnedpasswords.com',
  'https://haveibeenpwned.com',
] as const;

/** CDN used at runtime for Tesseract OCR assets (see P2 — slated for self-hosting). */
export const CDN_ORIGINS = ['https://cdn.jsdelivr.net'] as const;

/**
 * Builds the Content-Security-Policy string.
 *
 * NOTE: `script-src` still permits 'unsafe-inline'/'unsafe-eval'. Removing
 * those requires the hash-based strict CSP pipeline (plan item S2, Phase 2)
 * and is intentionally out of scope for this change. Everything else here is
 * already hardened: HIBP egress is allowed (S3) and clickjacking/injection
 * directives are added (S2 partial).
 */
export function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...CDN_ORIGINS],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...CDN_ORIGINS, ...HIBP_ORIGINS],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
  };

  return (
    Object.entries(directives)
      .map(([name, values]) => `${name} ${values.join(' ')}`)
      .join('; ') + ';'
  );
}

/**
 * The full set of security headers applied to every route.
 *
 * X-XSS-Protection is intentionally set to `0`: the legacy XSS auditor has
 * been removed from modern browsers and can itself introduce vulnerabilities;
 * CSP is the real defense. (OWASP Secure Headers Project guidance.)
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': buildContentSecurityPolicy(),
};
