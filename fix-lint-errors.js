#!/usr/bin/env node
/**
 * Auto-fix common ESLint errors in test files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all test files
const testDir = path.join(__dirname, 'src', '__tests__');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix: Remove unused 'vi' import from vitest
  if (content.includes("import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';")) {
    const viUsed = content.includes('vi.') || content.includes('vi(');
    if (!viUsed) {
      content = content.replace(
        "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';",
        "import { describe, it, expect, beforeEach, afterEach } from 'vitest';"
      );
      modified = true;
    }
  }

  // Fix: Add String() wrapper for template literals with numbers
  content = content.replace(/\$\{(\d+|i|index)\}/g, (match, num) => {
    if (/^\d+$/.test(num)) return match; // Already a literal number
    return `\${String(${num})}`;
  });

  // Fix: Remove 'async' from arrow functions with no 'await'
  // This is more complex and requires AST parsing, skip for now

  // Fix: Add type assertions for error types
  content = content.replace(/catch \(error\)/g, 'catch (error: unknown)');

  if (modified || content !== fs.readFileSync(filePath, 'utf-8')) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  return false;
}

// Recursively find all .ts and .tsx files
function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.ts') || item.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

const testFiles = findTestFiles(testDir);
let fixedCount = 0;

for (const file of testFiles) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
console.log('\nRunning ESLint with --fix...');

try {
  execSync('npm run lint -- --fix', { stdio: 'inherit' });
} catch (error) {
  console.log('ESLint --fix completed with errors (expected)');
}

console.log('\nDone!');
