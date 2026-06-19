import { describe, it, expect, afterEach, vi } from 'vitest';
import { runPrompt } from '@/core/ai/promptApi';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}

function streamOf(chunks: string[]) {
  return (async function* () {
    for (const c of chunks) yield c;
  })();
}

describe('promptApi.runPrompt', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
  });

  it('concatenates streamed chunks and destroys the session', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['Hello ', 'world']));
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create });

    const text = await runPrompt({ systemPrompt: 'sys', userPrompt: 'user' });

    expect(text).toBe('Hello world');
    expect(create).toHaveBeenCalledWith({ initialPrompts: [{ role: 'system', content: 'sys' }] });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('destroys the session even if streaming throws', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn(() => { throw new Error('stream fail'); });
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create });

    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow('stream fail');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('throws when LanguageModel is absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow();
  });
});
