#!/usr/bin/env node
/**
 * Copy self-hosted Tesseract OCR assets into public/ocr/ (P2 — supply chain).
 *
 * Replaces the runtime cdn.jsdelivr.net dependency: worker, WASM core, and
 * eng language data are served same-origin, pinned via package-lock.json.
 * public/ocr/ is gitignored; this script runs via predev/prebuild hooks.
 *
 * Sources:
 *  - tesseract.js/dist/worker.min.js           (worker)
 *  - tesseract.js-core/tesseract-core*.{js,wasm}(.js)  (SIMD + non-SIMD cores)
 *  - @tesseract.js-data/eng/4.0.0/eng.traineddata.gz   (language data)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const OUT = path.join(ROOT, 'public', 'ocr');

const ASSETS = [
  // [source (relative to node_modules), destination filename]
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm'],
  ['@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', 'eng.traineddata.gz'],
];

fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const [src, dest] of ASSETS) {
  const srcPath = path.join(NM, src);
  const destPath = path.join(OUT, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`[ocr-assets] MISSING: ${src} — run npm install`);
    process.exitCode = 1;
    continue;
  }
  // Skip copy when destination is already up to date (same size + newer mtime)
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

console.log(`[ocr-assets] public/ocr ready (${copied} file(s) copied, ${ASSETS.length} total)`);
