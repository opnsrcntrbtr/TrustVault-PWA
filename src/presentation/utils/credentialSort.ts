/**
 * Credential sorting + sort-preference persistence.
 *
 * Single source of truth for the dashboard's sort option values, the
 * comparators that back them, and localStorage persistence of the user's
 * chosen order. UI labels/icons live in SortDropdown; this module is pure
 * (no React) so it can be unit-tested in isolation.
 */
import type { Credential } from '@/domain/entities/Credential';

export type SortOption =
  | 'title-asc'
  | 'title-desc'
  | 'updated-desc'
  | 'created-desc'
  | 'favorites-first'
  | 'accessed-desc'
  | 'security-asc';

/** All valid option values, used for runtime validation of persisted input. */
export const SORT_OPTION_VALUES: readonly SortOption[] = [
  'title-asc',
  'title-desc',
  'updated-desc',
  'created-desc',
  'favorites-first',
  'accessed-desc',
  'security-asc',
];

export const DEFAULT_SORT: SortOption = 'updated-desc';

export const SORT_STORAGE_KEY = 'trustvault:dashboard:sortBy';

/** Type guard: is an unknown value a valid SortOption? */
export function isSortOption(value: unknown): value is SortOption {
  return typeof value === 'string' && (SORT_OPTION_VALUES as readonly string[]).includes(value);
}

const comparators: Record<SortOption, (a: Credential, b: Credential) => number> = {
  'title-asc': (a, b) => a.title.localeCompare(b.title),
  'title-desc': (a, b) => b.title.localeCompare(a.title),
  'updated-desc': (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  'created-desc': (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  'favorites-first': (a, b) => {
    if (a.isFavorite === b.isFavorite) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }
    return a.isFavorite ? -1 : 1;
  },
  // Most recently accessed first; never-accessed (no timestamp) sink to the bottom.
  'accessed-desc': (a, b) => {
    const ta = a.lastAccessedAt?.getTime() ?? -Infinity;
    const tb = b.lastAccessedAt?.getTime() ?? -Infinity;
    if (tb !== ta) return tb - ta;
    return a.title.localeCompare(b.title);
  },
  // Weakest password first; a missing score counts as 0 (weakest).
  'security-asc': (a, b) => {
    const sa = a.securityScore ?? 0;
    const sb = b.securityScore ?? 0;
    if (sa !== sb) return sa - sb;
    return a.title.localeCompare(b.title);
  },
};

/**
 * Returns a new array of credentials sorted by the given option.
 * Does not mutate the input.
 */
export function sortCredentials(credentials: Credential[], sortBy: SortOption): Credential[] {
  return [...credentials].sort(comparators[sortBy]);
}

/** Reads the persisted sort preference, falling back to DEFAULT_SORT. */
export function loadSortPreference(): SortOption {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY);
    return isSortOption(stored) ? stored : DEFAULT_SORT;
  } catch {
    // localStorage unavailable (private mode / SSR) — degrade gracefully.
    return DEFAULT_SORT;
  }
}

/** Persists the sort preference; silently no-ops if storage is unavailable. */
export function saveSortPreference(sortBy: SortOption): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sortBy);
  } catch {
    // Ignore — persistence is best-effort.
  }
}
