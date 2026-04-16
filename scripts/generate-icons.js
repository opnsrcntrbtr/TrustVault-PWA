#!/usr/bin/env node
/**
 * Generate PWA icons from SVG templates
 * Generates all required sizes for PWA and iOS
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const ICON_TEMPLATE = path.join(PUBLIC_DIR, 'icon-template.svg');
const MASKABLE_TEMPLATE = path.join(PUBLIC_DIR, 'icon-maskable-template.svg');

// Icon sizes to generate
const ICON_SIZES = [
  { size: 32, name: 'favicon.ico', template: 'regular' }, // Will convert to ICO separately
  { size: 180, name: 'apple-touch-icon.png', template: 'regular' },
  { size: 192, name: 'pwa-192x192.png', template: 'regular' },
  { size: 512, name: 'pwa-512x512.png', template: 'regular' },
  { size: 192, name: 'pwa-maskable-192x192.png', template: 'maskable' },
  { size: 512, name: 'pwa-maskable-512x512.png', template: 'maskable' },
];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  for (const { size, name, template } of ICON_SIZES) {
    const svgTemplate = template === 'maskable' ? MASKABLE_TEMPLATE : ICON_TEMPLATE;
    const outputPath = path.join(PUBLIC_DIR, name);

    try {
      if (name.endsWith('.ico')) {
        // For favicon, generate PNG first then convert
        const pngPath = path.join(PUBLIC_DIR, 'favicon-32x32.png');
        await sharp(svgTemplate)
          .resize(size, size)
          .png()
          .toFile(pngPath);

        console.log(`✓ Generated ${name} (${size}x${size}) - Note: Manual ICO conversion may be needed`);
        console.log(`  PNG created at: favicon-32x32.png`);
      } else {
        await sharp(svgTemplate)
          .resize(size, size)
          .png()
          .toFile(outputPath);

        console.log(`✓ Generated ${name} (${size}x${size})`);
      }
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  }

  console.log('\n✨ Icon generation complete!');
  console.log('\nGenerated files:');
  console.log('  - apple-touch-icon.png (180x180)');
  console.log('  - pwa-192x192.png (192x192)');
  console.log('  - pwa-512x512.png (512x512)');
  console.log('  - pwa-maskable-192x192.png (192x192)');
  console.log('  - pwa-maskable-512x512.png (512x512)');
  console.log('  - favicon-32x32.png (32x32)');
  console.log('\n💡 Note: favicon.ico should be generated from favicon-32x32.png');
  console.log('   You can use online tools like https://favicon.io/favicon-converter/');
}

// Run the generator
generateIcons().catch((error) => {
  console.error('Failed to generate icons:', error);
  process.exit(1);
});
