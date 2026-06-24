import { describe, it, expect } from 'vitest';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
import { litertProvider } from '@/core/ai/providers/litertProvider';

describe('AiProvider.supports', () => {
  it('chrome-builtin supports all new capabilities', () => {
    for (const cap of ['structured', 'params', 'quota', 'languages'] as const) {
      expect(chromeBuiltinProvider.supports(cap)).toBe(true);
    }
  });
  it('webllm and litert support none', () => {
    for (const cap of ['structured', 'params', 'quota', 'languages'] as const) {
      expect(webllmProvider.supports(cap)).toBe(false);
      expect(litertProvider.supports(cap)).toBe(false);
    }
  });
});
