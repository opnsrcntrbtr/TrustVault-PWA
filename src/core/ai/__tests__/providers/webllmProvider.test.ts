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
});
