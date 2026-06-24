import { describe, it, expect } from 'vitest';
import { resolveAiLanguage } from '@/core/ai/aiLanguages';

describe('resolveAiLanguage', () => {
  it('maps a supported region locale to its base code', () => {
    expect(resolveAiLanguage('es-MX')).toBe('es');
    expect(resolveAiLanguage('fr')).toBe('fr');
  });
  it('falls back to en for unsupported', () => {
    expect(resolveAiLanguage('zh-CN')).toBe('en');
    expect(resolveAiLanguage(undefined)).toBe('en');
  });
});
