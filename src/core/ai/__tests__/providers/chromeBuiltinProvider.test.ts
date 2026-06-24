import { describe, it, expect, afterEach, vi } from 'vitest';
import { chromeBuiltinProvider, __clearChromeSessionCacheForTesting } from '@/core/ai/providers/chromeBuiltinProvider';

function setLanguageModel(value: unknown) {
  (globalThis as Record<string, unknown>).LanguageModel = value;
}
function streamOf(chunks: string[]) {
  return (function* () { for (const c of chunks) yield c; })();
}
async function collect(it: AsyncIterableIterator<string>) {
  let s = ''; for await (const c of it) s += c; return s;
}

describe('chromeBuiltinProvider', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    vi.restoreAllMocks();
    __clearChromeSessionCacheForTesting();
  });

  it('id is chrome-builtin', () => {
    expect(chromeBuiltinProvider.id).toBe('chrome-builtin');
  });

  it('getAvailability returns unavailable when global absent', async () => {
    delete (globalThis as Record<string, unknown>).LanguageModel;
    expect(await chromeBuiltinProvider.getAvailability()).toBe('unavailable');
  });

  it('getAvailability reflects LanguageModel.availability()', async () => {
    setLanguageModel({ availability: vi.fn().mockResolvedValue('available'), create: vi.fn() });
    expect(await chromeBuiltinProvider.getAvailability()).toBe('available');
  });

  it('runStreaming clones the warmed base session, streams, and destroys the clone', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['Hello ', 'world']));
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const text = await collect(chromeBuiltinProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' }));

    expect(text).toBe('Hello world');
    expect(create).toHaveBeenCalledWith({ initialPrompts: [{ role: 'system', content: 'sys' }] });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('warmUp creates the base session only once per system prompt', async () => {
    const create = vi.fn().mockResolvedValue({ clone: vi.fn(), destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn() });
    await chromeBuiltinProvider.warmUp('sys');
    await chromeBuiltinProvider.warmUp('sys');
    expect(create).toHaveBeenCalledOnce();
  });

  it('runStreaming falls back to create() when clone() is absent', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['ok']));
    const create = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create, availability: vi.fn() });
    const text = await collect(chromeBuiltinProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' }));
    expect(text).toBe('ok');
    expect(create).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('ensureReady resolves without calling create (never-download)', async () => {
    const create = vi.fn();
    setLanguageModel({ create, availability: vi.fn() });
    await expect(chromeBuiltinProvider.ensureReady()).resolves.toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('createChatSession reuses ONE cloned session across turns and destroys on destroy()', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn()
      .mockReturnValueOnce(streamOf(['A1']))
      .mockReturnValueOnce(streamOf(['A2']));
    const clone = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    const create = vi.fn().mockResolvedValue({ clone, destroy });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const chat = await chromeBuiltinProvider.createChatSession('sys');
    expect(await collect(chat.send('q1'))).toBe('A1');
    expect(await collect(chat.send('q2'))).toBe('A2');

    expect(clone).toHaveBeenCalledOnce();        // session reused, not re-cloned
    expect(promptStreaming).toHaveBeenCalledTimes(2);
    chat.destroy();
    chat.destroy();                               // idempotent
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('createChatSession.send rejects after destroy()', async () => {
    const clone = vi.fn().mockResolvedValue({ promptStreaming: vi.fn(), destroy: vi.fn() });
    const create = vi.fn().mockResolvedValue({ clone, destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });
    const chat = await chromeBuiltinProvider.createChatSession('sys');
    chat.destroy();
    await expect(collect(chat.send('q'))).rejects.toThrow('destroyed');
  });

  it('threads params and language hints into create()', async () => {
    const destroy = vi.fn();
    const promptStreaming = vi.fn().mockReturnValue(streamOf(['ok']));
    const createSpy = vi.fn().mockResolvedValue({ promptStreaming, destroy });
    setLanguageModel({ create: createSpy, availability: vi.fn().mockResolvedValue('available') });

    const text = await collect(chromeBuiltinProvider.runStreaming({
      systemPrompt: 'sys',
      userPrompt: 'hi',
      params: { temperature: 0.3, topK: 3 },
      languages: { expectedInputLanguages: ['en'], outputLanguage: 'es' },
    }));

    expect(text).toBe('ok');
    expect(createSpy).toHaveBeenCalledWith({
      initialPrompts: [{ role: 'system', content: 'sys' }],
      temperature: 0.3,
      topK: 3,
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['es'] }],
    });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('chat session measureUsage reports usage/quota when the session supports it', async () => {
    const measureInputUsage = vi.fn().mockResolvedValue(42);
    const clone = vi.fn().mockResolvedValue({
      promptStreaming: vi.fn(), destroy: vi.fn(), measureInputUsage, inputQuota: 1024,
    });
    const create = vi.fn().mockResolvedValue({ clone, destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const chat = await chromeBuiltinProvider.createChatSession('sys');
    const usage = await chat.measureUsage?.('hello');
    expect(usage).toEqual({ usage: 42, quota: 1024 });
  });

  it('chat session measureUsage returns null when unsupported', async () => {
    const clone = vi.fn().mockResolvedValue({ promptStreaming: vi.fn(), destroy: vi.fn() });
    const create = vi.fn().mockResolvedValue({ clone, destroy: vi.fn() });
    setLanguageModel({ create, availability: vi.fn().mockResolvedValue('available') });

    const chat = await chromeBuiltinProvider.createChatSession('sys');
    expect(await chat.measureUsage?.('hello')).toBeNull();
  });
});
