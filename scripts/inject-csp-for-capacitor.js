#!/usr/bin/env node
/**
 * Inject a meta-tag CSP into the native Android WebView shell (Phase 6 —
 * OCR_NATIVE_ANDROID_PLAN.md / OCR_PHASE5_SECURITY_AUDIT.md finding A).
 *
 * Capacitor serves the app from `https://localhost` with no HTTP server in
 * front of it, so the header-based CSP in vite.config.ts / vercel.json never
 * applies on-device. This script runs after `cap sync android` (which copies
 * webDir into android/app/src/main/assets/public/) and injects the same
 * policy as a <meta http-equiv="Content-Security-Policy"> tag, imported
 * directly from securityHeaders.ts — never duplicated — so the native policy
 * can't drift from the web one.
 *
 * `frame-ancestors` is dropped: the CSP spec requires browsers to ignore it
 * when delivered via <meta>, and it protects against being framed by another
 * site — meaningless for a native WebView that isn't loaded from the web.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildContentSecurityPolicy } from '../src/config/securityHeaders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html');

const CSP_META_START = '<meta http-equiv="Content-Security-Policy"';

function buildMetaCsp() {
  const policy = buildContentSecurityPolicy()
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith('frame-ancestors'))
    .join('; ') + ';';
  return `${CSP_META_START} content="${policy}">`;
}

function main() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.log(
      `[inject-csp] android/ project not generated yet (no ${path.relative(ROOT, INDEX_HTML)}) — skipping. Run "npx cap add android" first.`
    );
    return;
  }

  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  // Idempotent: strip any previously injected CSP meta tag before re-inserting.
  html = html.replace(new RegExp(`\\s*${CSP_META_START}[^>]*>`), '');

  const metaTag = buildMetaCsp();
  html = html.replace('<head>', `<head>\n  ${metaTag}`);

  fs.writeFileSync(INDEX_HTML, html, 'utf8');
  console.log(`[inject-csp] CSP meta tag injected into ${path.relative(ROOT, INDEX_HTML)}`);
}

main();
