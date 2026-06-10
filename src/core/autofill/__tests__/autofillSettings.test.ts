/**
 * Autofill Settings Tests (Use Case 2 — autofill opt-in)
 * Validates secure-by-default settings, localStorage persistence with
 * graceful corruption handling, and per-origin enable/exclude rules.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_AUTOFILL_SETTINGS,
  loadAutofillSettings,
  saveAutofillSettings,
  isAutofillEnabledForOrigin,
  excludeOrigin,
  includeOrigin,
  toggleAutofill,
  type AutofillSettings,
} from '@/core/autofill/autofillSettings';

const STORAGE_KEY = 'trustvault_autofill_settings';

function enabledSettings(overrides: Partial<AutofillSettings> = {}): AutofillSettings {
  return { ...DEFAULT_AUTOFILL_SETTINGS, enabled: true, ...overrides };
}

describe('autofillSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('secure defaults', () => {
    it('is opt-in (disabled), never auto-submits, requires confirmation, HTTPS-only', () => {
      expect(DEFAULT_AUTOFILL_SETTINGS.enabled).toBe(false);
      expect(DEFAULT_AUTOFILL_SETTINGS.autoSubmit).toBe(false);
      expect(DEFAULT_AUTOFILL_SETTINGS.requireConfirmation).toBe(true);
      expect(DEFAULT_AUTOFILL_SETTINGS.onlyHTTPS).toBe(true);
      expect(DEFAULT_AUTOFILL_SETTINGS.excludedOrigins).toEqual([]);
    });
  });

  describe('loadAutofillSettings()', () => {
    it('returns defaults when nothing is stored', () => {
      expect(loadAutofillSettings()).toEqual(DEFAULT_AUTOFILL_SETTINGS);
    });

    it('returns defaults when stored JSON is corrupted (graceful failure)', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json!!!');
      expect(loadAutofillSettings()).toEqual(DEFAULT_AUTOFILL_SETTINGS);
    });

    it('merges a partial stored object over defaults', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true }));
      const settings = loadAutofillSettings();
      expect(settings.enabled).toBe(true);
      // Untouched fields keep their secure defaults
      expect(settings.autoSubmit).toBe(false);
      expect(settings.onlyHTTPS).toBe(true);
    });
  });

  describe('saveAutofillSettings()', () => {
    it('round-trips through localStorage', () => {
      const settings = enabledSettings({ excludedOrigins: ['https://evil.example'] });
      saveAutofillSettings(settings);
      expect(loadAutofillSettings()).toEqual(settings);
    });
  });

  describe('isAutofillEnabledForOrigin()', () => {
    it('returns false when autofill is globally disabled', () => {
      expect(
        isAutofillEnabledForOrigin('https://site.example', DEFAULT_AUTOFILL_SETTINGS)
      ).toBe(false);
    });

    it('returns false for an excluded origin even when enabled', () => {
      const settings = enabledSettings({ excludedOrigins: ['https://site.example'] });
      expect(isAutofillEnabledForOrigin('https://site.example', settings)).toBe(false);
    });

    it('rejects non-HTTPS origins when onlyHTTPS is set', () => {
      const settings = enabledSettings();
      expect(isAutofillEnabledForOrigin('http://site.example', settings)).toBe(false);
    });

    it('allows HTTPS origins when enabled and not excluded', () => {
      const settings = enabledSettings();
      expect(isAutofillEnabledForOrigin('https://site.example', settings)).toBe(true);
    });

    it('allows HTTP origins only when onlyHTTPS is explicitly disabled', () => {
      const settings = enabledSettings({ onlyHTTPS: false });
      expect(isAutofillEnabledForOrigin('http://site.example', settings)).toBe(true);
    });

    it('falls back to persisted settings when none are passed', () => {
      saveAutofillSettings(enabledSettings());
      expect(isAutofillEnabledForOrigin('https://site.example')).toBe(true);
    });
  });

  describe('excludeOrigin() / includeOrigin()', () => {
    it('adds an origin to the exclusion list and persists it', () => {
      saveAutofillSettings(enabledSettings());
      excludeOrigin('https://site.example');
      expect(loadAutofillSettings().excludedOrigins).toContain('https://site.example');
      expect(isAutofillEnabledForOrigin('https://site.example')).toBe(false);
    });

    it('is idempotent — excluding twice stores the origin once', () => {
      saveAutofillSettings(enabledSettings());
      excludeOrigin('https://site.example');
      excludeOrigin('https://site.example');
      const { excludedOrigins } = loadAutofillSettings();
      expect(excludedOrigins.filter((o) => o === 'https://site.example')).toHaveLength(1);
    });

    it('includeOrigin removes the exclusion', () => {
      saveAutofillSettings(enabledSettings({ excludedOrigins: ['https://site.example'] }));
      includeOrigin('https://site.example');
      expect(loadAutofillSettings().excludedOrigins).not.toContain('https://site.example');
      expect(isAutofillEnabledForOrigin('https://site.example')).toBe(true);
    });
  });

  describe('toggleAutofill()', () => {
    it('persists the global enabled flag both ways', () => {
      toggleAutofill(true);
      expect(loadAutofillSettings().enabled).toBe(true);

      toggleAutofill(false);
      expect(loadAutofillSettings().enabled).toBe(false);
    });
  });
});
