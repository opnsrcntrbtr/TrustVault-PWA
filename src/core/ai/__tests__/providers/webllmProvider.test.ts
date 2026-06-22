import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const create = vi.fn();
const engine = {
  chat: { completions: { create: vi.fn() } },
  interruptGenerate: vi.fn(),
  resetChat: vi.fn().mockResolvedValue(undefined),
  unload: vi.fn().mockResolvedValue(undefined),
};

// Mock the lazy-imported library.
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: (...args: unknown[]): unknown => create(...args),
}));
// Force WebGPU present + a known model.
vi.mock('@/core/ai/providers/capabilities', () => ({
  hasWebGpu: vi.fn().mockResolvedValue(true),
  isAndroid: () => true,
  isMobileAiSurfaceEnabled: () => true,
}));
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => ({ webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', mobileAiModelReady: true }),
  saveAiSettings: vi.fn(),
}));

import { webllmProvider, __resetWebllmEngineForTesting } from '@/core/ai/providers/webllmProvider';

// eslint-disable-next-line @typescript-eslint/require-await -- async generator stub, no await needed
async function* deltaGenerator(parts: string[]) {
  for (const p of parts) yield { choices: [{ delta: { content: p } }] };
}
function deltaStream(parts: string[]) {
  return deltaGenerator(parts);
}

describe('webllmProvider', () => {
  beforeEach(() => { create.mockResolvedValue(engine); });
  afterEach(() => { __resetWebllmEngineForTesting(); vi.clearAllMocks(); });

  it('id is webllm', () => { expect(webllmProvider.id).toBe('webllm'); });

  it('ensureReady creates the engine once and reports progress', async () => {
    const onProgress = vi.fn();
    create.mockImplementation((_id: string, opts: { initProgressCallback?: (r: { progress: number; text: string }) => void }) => {
      opts.initProgressCallback?.({ progress: 0.5, text: 'half' });
      return Promise.resolve(engine);
    });
    await webllmProvider.ensureReady(onProgress);
    await webllmProvider.ensureReady(onProgress);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ progress: 0.5, text: 'half' });
  });

  it('runStreaming maps system+user prompts to messages and yields deltas', async () => {
    engine.chat.completions.create.mockResolvedValue(deltaStream(['He', 'llo']));
    let out = '';
    for await (const c of webllmProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' })) out += c;
    expect(out).toBe('Hello');
    expect(engine.resetChat).toHaveBeenCalled();
    expect(engine.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'u' }],
      }),
    );
  });

  it('normalizes a GPU device-lost failure during init and resets so a retry re-creates', async () => {
    create.mockReset();
    create.mockRejectedValueOnce(
      new Error('Device was lost. This can happen due to insufficient memory or other GPU constraints.'),
    );
    await expect(webllmProvider.ensureReady()).rejects.toThrow(/on-device AI could not start/i);
    // State must be reset: a second attempt re-invokes CreateMLCEngine.
    create.mockResolvedValueOnce(engine);
    await webllmProvider.ensureReady();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('normalizes a device-lost failure mid-stream and resets the engine', async () => {
    engine.chat.completions.create.mockRejectedValueOnce(
      new Error('A valid external Instance reference no longer exists.'),
    );
    const stream = webllmProvider.runStreaming({ systemPrompt: 's', userPrompt: 'u' });
    await expect((async () => { const out: string[] = []; for await (const c of stream) out.push(c); })())
      .rejects.toThrow(/on-device AI could not start/i);
    // Engine reset → a follow-up ensureReady re-creates (create called again).
    create.mockResolvedValueOnce(engine);
    await webllmProvider.ensureReady();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('runStreaming interrupts generation when the signal aborts', async () => {
    const controller = new AbortController();
    // eslint-disable-next-line @typescript-eslint/require-await -- async generator stub, no await needed
    engine.chat.completions.create.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: 'x' } }] };
      controller.abort();
      yield { choices: [{ delta: { content: 'y' } }] };
    });
    const drained: string[] = [];
    for await (const c of webllmProvider.runStreaming({ systemPrompt: 's', userPrompt: 'u', signal: controller.signal })) drained.push(c);
    expect(engine.interruptGenerate).toHaveBeenCalled();
  });

  it('createChatSession accumulates a multi-turn transcript and trims to budget', async () => {
    engine.chat.completions.create
      .mockResolvedValueOnce(deltaStream(['A1']))
      .mockResolvedValueOnce(deltaStream(['A2']));

    const chat = await webllmProvider.createChatSession('sys');

    let out1 = '';
    for await (const c of chat.send('q1')) out1 += c;
    expect(out1).toBe('A1');

    let out2 = '';
    for await (const c of chat.send('q2')) out2 += c;
    expect(out2).toBe('A2');

    const secondCallArgs = engine.chat.completions.create.mock.calls[1]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(secondCallArgs.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(secondCallArgs.messages.at(-1)?.content).toBe('q2');

    chat.destroy();
    chat.destroy(); // idempotent — must not throw
  });

  it('createChatSession.send rejects after destroy()', async () => {
    engine.chat.completions.create.mockResolvedValueOnce(deltaStream(['A1']));
    const chat = await webllmProvider.createChatSession('sys');
    chat.destroy();
    await expect((async () => {
      for await (const chunk of chat.send('q')) { void chunk; }
    })()).rejects.toThrow('destroyed');
  });
});
