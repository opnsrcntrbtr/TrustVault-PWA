import { describe, it, expect, afterEach, vi } from 'vitest';
import { runPrompt, warmUpAi, __clearSessionCacheForTesting } from '@/core/ai/promptApi';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}

function streamOf(chunks: string[]) {
  return (function* () {
    for (const c of chunks) yield c;
  })();
}

describe('promptApi.runPrompt', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
    __clearSessionCacheForTesting();
  });

  it('concatenates streamed chunks and destroys the session', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['Hello ', 'world']));
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create });

    const text = await runPrompt({ systemPrompt: 'sys', userPrompt: 'user' });

    expect(text).toBe('Hello world');
    expect(create).toHaveBeenCalledWith({ initialPrompts: [{ role: 'system', content: 'sys' }] });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('destroys the session even if streaming throws', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn(() => { throw new Error('stream fail'); });
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create });

    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow('stream fail');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('throws when LanguageModel is absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow();
  });

  it('falls back to create() when the session lacks clone()', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['ok']));
    // Sessions returned by create() have NO clone method.
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create });

    const text = await runPrompt({ systemPrompt: 'sys', userPrompt: 'user' });

    expect(text).toBe('ok');
    // One create() warms the base session, a second create() is the fallback clone.
    expect(create).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce(); // only the per-call session is destroyed
  });
});

describe('promptApi.warmUpAi (session caching)', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
    __clearSessionCacheForTesting();
  });

  it('creates the base session only once for repeated warm-ups of the same prompt', async () => {
    const clone = vi.fn();
    const create = vi.fn().mockResolvedValue({ clone, destroy: vi.fn() });
    setLanguageModel({ create });

    await warmUpAi('sys');
    await warmUpAi('sys');
    await warmUpAi('sys');

    expect(create).toHaveBeenCalledOnce();
  });

  it('shares the in-flight init promise across concurrent warm-ups', async () => {
    let resolveCreate!: (s: unknown) => void;
    const create = vi.fn().mockReturnValue(
      new Promise((resolve) => { resolveCreate = resolve; }),
    );
    setLanguageModel({ create });

    const a = warmUpAi('sys');
    const b = warmUpAi('sys');
    resolveCreate({ clone: vi.fn(), destroy: vi.fn() });
    await Promise.all([a, b]);

    expect(create).toHaveBeenCalledOnce();
  });

  it('keeps separate base sessions per system prompt', async () => {
    const create = vi.fn().mockResolvedValue({ clone: vi.fn(), destroy: vi.fn() });
    setLanguageModel({ create });

    await warmUpAi('sys-a');
    await warmUpAi('sys-b');

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('retries creation after a failed warm-up', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('init fail'))
      .mockResolvedValue({ clone: vi.fn(), destroy: vi.fn() });
    setLanguageModel({ create });

    await expect(warmUpAi('sys')).rejects.toThrow('init fail');
    await expect(warmUpAi('sys')).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
