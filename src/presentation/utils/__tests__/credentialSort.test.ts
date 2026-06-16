/**
 * Tests for credential sorting + sort-preference persistence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Credential } from '@/domain/entities/Credential';
import {
  sortCredentials,
  isSortOption,
  loadSortPreference,
  saveSortPreference,
  DEFAULT_SORT,
  SORT_STORAGE_KEY,
  type SortOption,
} from '../credentialSort';

function cred(overrides: Partial<Credential>): Credential {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Title',
    username: 'user',
    password: 'pw',
    category: 'login',
    tags: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    isFavorite: false,
    ...overrides,
  } as Credential;
}

describe('sortCredentials', () => {
  it('title-asc / title-desc sort alphabetically (case-insensitive)', () => {
    const list = [cred({ title: 'banana' }), cred({ title: 'Apple' }), cred({ title: 'cherry' })];
    expect(sortCredentials(list, 'title-asc').map((c) => c.title)).toEqual(['Apple', 'banana', 'cherry']);
    expect(sortCredentials(list, 'title-desc').map((c) => c.title)).toEqual(['cherry', 'banana', 'Apple']);
  });

  it('updated-desc and created-desc sort newest first', () => {
    const a = cred({ title: 'a', updatedAt: new Date(100), createdAt: new Date(300) });
    const b = cred({ title: 'b', updatedAt: new Date(200), createdAt: new Date(100) });
    expect(sortCredentials([a, b], 'updated-desc').map((c) => c.title)).toEqual(['b', 'a']);
    expect(sortCredentials([a, b], 'created-desc').map((c) => c.title)).toEqual(['a', 'b']);
  });

  it('favorites-first puts favorites before non-favorites', () => {
    const fav = cred({ title: 'fav', isFavorite: true, updatedAt: new Date(1) });
    const plain = cred({ title: 'plain', isFavorite: false, updatedAt: new Date(999) });
    expect(sortCredentials([plain, fav], 'favorites-first').map((c) => c.title)).toEqual(['fav', 'plain']);
  });

  it('accessed-desc sorts by lastAccessedAt with never-accessed last', () => {
    const recent = cred({ title: 'recent', lastAccessedAt: new Date(500) });
    const older = cred({ title: 'older', lastAccessedAt: new Date(100) });
    const never = cred({ title: 'never' });
    expect(sortCredentials([never, older, recent], 'accessed-desc').map((c) => c.title)).toEqual([
      'recent',
      'older',
      'never',
    ]);
  });

  it('security-asc sorts weakest password first; missing score treated as 0', () => {
    const strong = cred({ title: 'strong', securityScore: 90 });
    const weak = cred({ title: 'weak', securityScore: 20 });
    const none = cred({ title: 'none' }); // undefined -> 0, weakest
    expect(sortCredentials([strong, weak, none], 'security-asc').map((c) => c.title)).toEqual([
      'none',
      'weak',
      'strong',
    ]);
  });

  it('does not mutate the input array', () => {
    const list = [cred({ title: 'b' }), cred({ title: 'a' })];
    const snapshot = list.map((c) => c.title);
    sortCredentials(list, 'title-asc');
    expect(list.map((c) => c.title)).toEqual(snapshot);
  });
});

describe('isSortOption', () => {
  it('accepts known options and rejects junk', () => {
    expect(isSortOption('title-asc')).toBe(true);
    expect(isSortOption('accessed-desc')).toBe(true);
    expect(isSortOption('security-asc')).toBe(true);
    expect(isSortOption('nonsense')).toBe(false);
    expect(isSortOption(null)).toBe(false);
    expect(isSortOption(42)).toBe(false);
  });
});

describe('sort-preference persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns DEFAULT_SORT when nothing stored', () => {
    expect(loadSortPreference()).toBe(DEFAULT_SORT);
  });

  it('round-trips a saved valid option', () => {
    saveSortPreference('security-asc');
    expect(localStorage.getItem(SORT_STORAGE_KEY)).toBe('security-asc');
    expect(loadSortPreference()).toBe('security-asc');
  });

  it('falls back to DEFAULT_SORT when stored value is invalid', () => {
    localStorage.setItem(SORT_STORAGE_KEY, 'corrupted');
    expect(loadSortPreference()).toBe(DEFAULT_SORT);
  });

  it('exposes the full set of options including the two new ones', () => {
    const opts: SortOption[] = ['title-asc', 'title-desc', 'updated-desc', 'created-desc', 'favorites-first', 'accessed-desc', 'security-asc'];
    opts.forEach((o) => { expect(isSortOption(o)).toBe(true); });
  });
});
