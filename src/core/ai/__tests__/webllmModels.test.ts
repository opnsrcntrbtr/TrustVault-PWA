import { describe, it, expect } from 'vitest';
import { WEBLLM_MODELS, DEFAULT_WEBLLM_MODEL_ID, getModelById } from '@/core/ai/webllmModels';

describe('webllmModels', () => {
  it('has at least one small and one mid model', () => {
    expect(WEBLLM_MODELS.some(m => m.tier === 'small')).toBe(true);
    expect(WEBLLM_MODELS.some(m => m.tier === 'mid')).toBe(true);
  });
  it('default model id exists in the catalog and is small tier', () => {
    const def = getModelById(DEFAULT_WEBLLM_MODEL_ID);
    expect(def).toBeDefined();
    expect(def?.tier).toBe('small');
  });
  it('getModelById returns undefined for unknown ids', () => {
    expect(getModelById('nope')).toBeUndefined();
  });
});
