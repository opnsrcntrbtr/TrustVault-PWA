/**
 * Finding 5: pushing decrypted passwords into the browser's Credential
 * Management store must require the explicit autofill opt-in
 * (DEFAULT_AUTOFILL_SETTINGS.enabled === false) and a per-origin allow.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldStoreInBrowser } from '../credentialManagementService';
import { DEFAULT_AUTOFILL_SETTINGS, saveAutofillSettings } from '../autofillSettings';

describe('shouldStoreInBrowser', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is false by default (autofill is opt-in)', () => {
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(false);
  });

  it('is true once autofill is enabled for an allowed HTTPS origin', () => {
    saveAutofillSettings({ ...DEFAULT_AUTOFILL_SETTINGS, enabled: true });
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(true);
  });

  it('respects per-origin exclusions and the HTTPS-only rule', () => {
    saveAutofillSettings({
      ...DEFAULT_AUTOFILL_SETTINGS,
      enabled: true,
      excludedOrigins: ['https://example.com'],
    });
    expect(shouldStoreInBrowser('https://example.com/login')).toBe(false);
    expect(shouldStoreInBrowser('http://plain.example/login')).toBe(false);
  });

  it('is false for malformed URLs', () => {
    saveAutofillSettings({ ...DEFAULT_AUTOFILL_SETTINGS, enabled: true });
    expect(shouldStoreInBrowser('not a url')).toBe(false);
  });
});
