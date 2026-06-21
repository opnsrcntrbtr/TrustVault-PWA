import { describe, it, expect } from 'vitest';
import { LITERT_MODELS, DEFAULT_LITERT_MODEL_ID, getLitertModelById } from '@/core/ai/litertModels';

describe('litertModels', () => {
  it('has at least one tiny model', () => {
    expect(LITERT_MODELS.some(m => m.tier === 'tiny')).toBe(true);
  });
  it('every model url points at a -Web.litertlm file', () => {
    for (const m of LITERT_MODELS) {
      expect(m.url).toMatch(/-Web\.litertlm$/);
    }
  });
  it('default model id exists in the catalog and is tiny tier', () => {
    const def = getLitertModelById(DEFAULT_LITERT_MODEL_ID);
    expect(def).toBeDefined();
    expect(def?.tier).toBe('tiny');
  });
  it('getLitertModelById returns undefined for unknown ids', () => {
    expect(getLitertModelById('nope')).toBeUndefined();
  });
});
