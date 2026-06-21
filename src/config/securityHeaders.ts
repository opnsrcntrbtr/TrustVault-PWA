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

/**
 * Origins on-device AI fetches model weights/config from (Android: WebLLM and
 * LiteRT-LM both use these — see capabilities.ts for the per-engine
 * kill-switches). Weight download ONLY — no user data leaves the device.
 *
 * Confirmed via on-device Network-tab capture (2026-06-21, Llama-3.2-1B):
 *   - huggingface.co .............. mlc-chat-config.json, tokenizer, resolve URLs
 *   - *.xethub.hf.co / *.aws.cdn.hf.co ... weight shards (params_shard_*.bin)
 *       via HF's Xet storage backend. Shards are load-balanced across regional
 *       CDN hosts (observed: cas-bridge.xethub.hf.co, us.aws.cdn.hf.co), so we
 *       allow the two HF-controlled Xet CDN domains by wildcard rather than
 *       pinning region-specific hosts that would break downloads elsewhere.
 *       These replaced the legacy cdn-lfs*.huggingface.co LFS hosts (never hit).
 *   - raw.githubusercontent.com ... model_lib .wasm (mlc-ai/binary-mlc-llm-libs)
 *
 * LiteRT-LM's .litertlm weights resolve from the same huggingface.co/Xet hosts
 * (litert-community / google orgs on HF) — no additional origin was needed.
 * LiteRT-LM's own WASM *runtime* (as opposed to model weights) is NOT fetched
 * from any of these — it is self-hosted same-origin under public/litert/ (see
 * scripts/copy-litert-assets.js) specifically to avoid adding the package's
 * default https://cdn.jsdelivr.net dependency to this allowlist.
 */
export const WEBLLM_MODEL_ORIGINS = [
  'https://huggingface.co',
  'https://*.xethub.hf.co',
  'https://*.aws.cdn.hf.co',
  'https://raw.githubusercontent.com',
] as const;

// P2 (done): Tesseract OCR assets are self-hosted under public/ocr/ —
// the former cdn.jsdelivr.net allowance has been removed from the CSP.

/**
 * SHA-256 hash of the single inline bootstrap script in index.html (the
 * GitHub-Pages SPA redirect). Whitelisting the hash lets us drop
 * 'unsafe-inline' from script-src entirely (S2 — strict hash-based CSP).
 *
 * Drift guard: src/config/__tests__/securityHeaders.test.ts recomputes this
 * hash from index.html and fails if the script changes without updating it.
 */
export const INLINE_BOOTSTRAP_SCRIPT_HASH =
  'sha256-SPRG1jijJMMtUP5+1fDMpHzEVwoIHr49w64NNXdvcv8=';

/**
 * Builds the Content-Security-Policy string (S2 — strict CSP).
 *
 * script-src: no 'unsafe-inline' (replaced by the bootstrap script hash) and
 * no 'unsafe-eval' — WASM (self-hosted Tesseract core) needs only the
 * narrower 'wasm-unsafe-eval'.
 *
 * style-src: 'unsafe-inline' is retained as a DOCUMENTED RESIDUAL — MUI/
 * Emotion inject runtime <style> tags. Style injection is a far lower-risk
 * vector than script injection; revisit with Emotion nonce/hash support if
 * that changes (tracked in SECURITY_HARDENING_PLAN_2026-06.md, out of scope).
 */
export function buildContentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'${INLINE_BOOTSTRAP_SCRIPT_HASH}'`, "'wasm-unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...HIBP_ORIGINS, ...WEBLLM_MODEL_ORIGINS],
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

/**
 * DEV-SERVER-ONLY header variant (`vite dev`).
 *
 * @vitejs/plugin-react injects an inline React-refresh preamble and Vite's
 * HMR uses eval-based source maps, both of which the strict production CSP
 * blocks. Production (`vercel.json`) and `vite preview` always use the
 * strict SECURITY_HEADERS above — this relaxation never ships.
 */
export const DEV_SECURITY_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': buildContentSecurityPolicy()
    .replace(
      /script-src [^;]+/,
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    ),
};
