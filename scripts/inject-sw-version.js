#!/usr/bin/env node
/**
 * Post-build script to inject version and custom code into service worker
 * Runs after vite build to enhance the generated SW with update management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const SW_PATH = path.join(DIST_DIR, 'sw.js');
const CUSTOM_SW_PATH = path.join(__dirname, '../public/sw-custom.js');
const PACKAGE_JSON_PATH = path.resolve(__dirname, '../package.json');

// Read package.json for version
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
const APP_VERSION = `v${packageJson.version}-${Date.now()}`;

console.log(`[inject-sw-version] Injecting version ${APP_VERSION} into service worker...`);

try {
  // Read the generated service worker
  if (!fs.existsSync(SW_PATH)) {
    console.error(`[inject-sw-version] Service worker not found at ${SW_PATH}`);
    process.exit(1);
  }

  let swContent = fs.readFileSync(SW_PATH, 'utf-8');

  // Read custom service worker code
  const customCode = fs.readFileSync(CUSTOM_SW_PATH, 'utf-8')
    .replace('__APP_VERSION__', APP_VERSION);

  // Inject custom code at the beginning of the service worker
  swContent = `${customCode}\n\n${swContent}`;

  // Write back the enhanced service worker
  fs.writeFileSync(SW_PATH, swContent, 'utf-8');

  console.log(`[inject-sw-version] ✓ Service worker enhanced with version ${APP_VERSION}`);
  console.log(`[inject-sw-version] ✓ Custom code injected successfully`);

} catch (error) {
  console.error('[inject-sw-version] Error:', error);
  process.exit(1);
}
