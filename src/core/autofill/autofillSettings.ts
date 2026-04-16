/**
 * Autofill Settings & Preferences
 * User-configurable autofill behavior
 */

export interface AutofillSettings {
  enabled: boolean;
  autoSubmit: boolean; // Auto-submit form after filling
  requireConfirmation: boolean; // Show confirmation before filling
  enableCrossDomain: boolean; // Allow subdomain matching
  onlyHTTPS: boolean; // Only autofill on HTTPS sites
  excludedOrigins: string[]; // Origins where autofill is disabled
}

const STORAGE_KEY = 'trustvault_autofill_settings';

/**
 * Default autofill settings (secure by default)
 */
export const DEFAULT_AUTOFILL_SETTINGS: AutofillSettings = {
  enabled: false, // Opt-in for security
  autoSubmit: false, // Never auto-submit for security
  requireConfirmation: true, // Always ask user
  enableCrossDomain: true, // Allow subdomain matching
  onlyHTTPS: true, // HTTPS only for security
  excludedOrigins: [],
};

/**
 * Load autofill settings from localStorage
 */
export function loadAutofillSettings(): AutofillSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as AutofillSettings;
      return { ...DEFAULT_AUTOFILL_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load autofill settings:', error);
  }

  return DEFAULT_AUTOFILL_SETTINGS;
}

/**
 * Save autofill settings to localStorage
 */
export function saveAutofillSettings(settings: AutofillSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('Autofill settings saved');
  } catch (error) {
    console.error('Failed to save autofill settings:', error);
  }
}

/**
 * Check if autofill is enabled for specific origin
 */
export function isAutofillEnabledForOrigin(origin: string, settings?: AutofillSettings): boolean {
  const currentSettings = settings || loadAutofillSettings();

  if (!currentSettings.enabled) {
    return false;
  }

  // Check if origin is excluded
  if (currentSettings.excludedOrigins.includes(origin)) {
    return false;
  }

  // Check HTTPS requirement
  if (currentSettings.onlyHTTPS && !origin.startsWith('https://')) {
    return false;
  }

  return true;
}

/**
 * Add origin to exclusion list
 */
export function excludeOrigin(origin: string): void {
  const settings = loadAutofillSettings();

  if (!settings.excludedOrigins.includes(origin)) {
    settings.excludedOrigins.push(origin);
    saveAutofillSettings(settings);
  }
}

/**
 * Remove origin from exclusion list
 */
export function includeOrigin(origin: string): void {
  const settings = loadAutofillSettings();
  settings.excludedOrigins = settings.excludedOrigins.filter(o => o !== origin);
  saveAutofillSettings(settings);
}

/**
 * Toggle autofill globally
 */
export function toggleAutofill(enabled: boolean): void {
  const settings = loadAutofillSettings();
  settings.enabled = enabled;
  saveAutofillSettings(settings);
}
