#!/usr/bin/env node
/**
 * Copy self-hosted LiteRT-LM WASM runtime into public/litert/ (Android on-device AI).
 *
 * @litert-lm/core's Engine.create() bootstraps its WASM module via
 * getOrLoadGlobalLiteRtLm(), which defaults to fetching ~37MB from
 * https://cdn.jsdelivr.net/npm/@litert-lm/core@<version>/wasm — a third-party
 * CDN this project does not allowlist. Self-hosting (same pattern as Tesseract
 * OCR in copy-ocr-assets.js) keeps the runtime same-origin so no new CSP
 * connect-src/script-src exception is needed.
 * public/litert/ is gitignored; this script runs via predev/prebuild hooks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'litert');

const ASSETS = [
  // [source (relative to node_modules), destination filename]
  ['@litert-lm/core/wasm/litertlm_wasm_internal.js', 'litertlm_wasm_internal.js'],
  ['@litert-lm/core/wasm/litertlm_wasm_internal.wasm', 'litertlm_wasm_internal.wasm'],
  ['@litert-lm/core/wasm/litertlm_wasm_compat_internal.js', 'litertlm_wasm_compat_internal.js'],
  ['@litert-lm/core/wasm/litertlm_wasm_compat_internal.wasm', 'litertlm_wasm_compat_internal.wasm'],
];

fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const [src, dest] of ASSETS) {
  const srcPath = path.join(NM, src);
  const destPath = path.join(OUT, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`[litert-assets] MISSING: ${src} — run npm install`);
    process.exitCode = 1;
    continue;
  }
  if (fs.existsSync(destPath)) {
    const s = fs.statSync(srcPath);
    const d = fs.statSync(destPath);
    if (s.size === d.size && d.mtimeMs >= s.mtimeMs) {
      continue;
    }
  }
  fs.copyFileSync(srcPath, destPath);
  copied += 1;
}

console.log(`[litert-assets] public/litert ready (${copied} file(s) copied, ${ASSETS.length} total)`);
