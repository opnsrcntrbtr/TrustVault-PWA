/**
 * On-device AI settings (enabled by default).
 * localStorage module — mirrors autofillSettings.ts. No Zustand.
 */

export interface AiSettings {
  /** Master toggle for Chrome built-in AI. */
  enableOnDeviceAI: boolean;
  /** Feature toggle for the strength-explanation feature. */
  allowStrengthExplanation: boolean;
}

const STORAGE_KEY = 'trustvault_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableOnDeviceAI: true,
  allowStrengthExplanation: true,
};

export function loadAiSettings(): AiSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiSettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load AI settings:', error);
  }
  return DEFAULT_AI_SETTINGS;
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save AI settings:', error);
  }
}
