import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_AI_SETTINGS,
  loadAiSettings,
  saveAiSettings,
  type AiSettings,
} from '@/core/ai/aiSettings';

const STORAGE_KEY = 'trustvault_ai_settings';

describe('aiSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('defaults both toggles to true', () => {
    expect(DEFAULT_AI_SETTINGS).toEqual({
      enableOnDeviceAI: true,
      allowStrengthExplanation: true,
    });
  });

  it('returns defaults when storage empty', () => {
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('merges stored partial over defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enableOnDeviceAI: false }));
    expect(loadAiSettings()).toEqual({
      enableOnDeviceAI: false,
      allowStrengthExplanation: true,
    });
  });

  it('round-trips saved settings', () => {
    const s: AiSettings = { enableOnDeviceAI: true, allowStrengthExplanation: true };
    saveAiSettings(s);
    expect(loadAiSettings()).toEqual(s);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadAiSettings()).toEqual(DEFAULT_AI_SETTINGS);
  });
});
