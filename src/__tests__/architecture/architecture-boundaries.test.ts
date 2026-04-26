import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function listSourceFiles(directory: string): string[] {
  const absoluteDirectory = join(root, directory);
  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = join(absoluteDirectory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      return listSourceFiles(relative(root, absolutePath));
    }
    return /\.(ts|tsx|js)$/.test(entry) ? [absolutePath] : [];
  });
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('architecture boundaries', () => {
  it('keeps presentation code out of data adapters', () => {
    const files = [
      ...listSourceFiles('src/presentation'),
      ...listSourceFiles('src/components'),
      ...listSourceFiles('src/hooks'),
    ];

    const offenders = files
      .filter((file) => read(file).includes('@/data/'))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('keeps core code independent from feature, presentation, and data layers', () => {
    const files = listSourceFiles('src/core');
    const forbidden = ['@/features/', '@/presentation/', '@/data/'];

    const offenders = files
      .filter((file) => forbidden.some((importPath) => read(file).includes(importPath)))
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('does not persist secret auth fields through the Zustand auth store', () => {
    const authStore = read(join(root, 'src/presentation/store/authStore.ts'));

    expect(authStore).toContain('toPublicUser');
    expect(authStore).not.toMatch(/partialize:[\s\S]*(hashedMasterPassword|encryptedVaultKey|salt|webAuthnCredentials)/);
  });

  it('does not store extension credentials in chrome storage', () => {
    const extensionFiles = listSourceFiles('chrome-extension/scripts');
    const offenders = extensionFiles
      .filter((file) =>
        /chrome\.storage\.local\.(get|set)\([^)]*credentials/.test(read(file))
      )
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });
});
