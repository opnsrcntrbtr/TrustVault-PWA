import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const loadLiteRtLm = vi.fn();
const engineCreate = vi.fn();
const conversationCancel = vi.fn();
const conversationDelete = vi.fn().mockResolvedValue(undefined);
const engineDelete = vi.fn().mockResolvedValue(undefined);

function makeReadableStream(messages: Array<{ role: string; content: Array<{ type: string; text?: string }> }>) {
  return new ReadableStream({
    start(controller) {
      for (const m of messages) controller.enqueue(m);
      controller.close();
    },
  });
}

const conversation = {
  sendMessageStreaming: vi.fn(),
  cancel: conversationCancel,
  delete: conversationDelete,
};
const engine = {
  createConversation: vi.fn().mockResolvedValue(conversation),
  delete: engineDelete,
};

// Mock the lazy-imported library.
vi.mock('@litert-lm/core', () => ({
  loadLiteRtLm: (...args: unknown[]): unknown => loadLiteRtLm(...args),
  Engine: { create: (...args: unknown[]): unknown => engineCreate(...args) },
}));
// Force WebGPU present + a known model, mirroring webllmProvider.test.ts.
vi.mock('@/core/ai/providers/capabilities', () => ({
  hasWebGpu: vi.fn().mockResolvedValue(true),
  isAndroid: () => true,
  isMobileAiSurfaceEnabled: () => true,
}));
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => ({ litertModelId: 'gemma-3n-E2B-it', litertModelReady: true }),
  saveAiSettings: vi.fn(),
}));
vi.mock('@/core/ai/litertModels', () => ({
  getLitertModelById: () => ({ id: 'gemma-3n-E2B-it', url: 'https://huggingface.co/x/y/resolve/main/m-Web.litertlm', approxMB: 1500, tier: 'tiny', label: 'Tiny' }),
}));

import { litertProvider, __resetLitertEngineForTesting } from '@/core/ai/providers/litertProvider';

describe('litertProvider', () => {
  beforeEach(() => {
    loadLiteRtLm.mockResolvedValue(undefined);
    engineCreate.mockResolvedValue(engine);
    conversation.sendMessageStreaming.mockReturnValue(makeReadableStream([
      { role: 'assistant', content: [{ type: 'text', text: 'Hel' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'lo' }] },
    ]));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-length': '10' }),
      body: makeReadableStream([]).pipeThrough(new TransformStream()) as unknown as ReadableStream<Uint8Array>,
    })));
  });
  afterEach(() => {
    __resetLitertEngineForTesting();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('id is litert-lm', () => {
    expect(litertProvider.id).toBe('litert-lm');
  });

  it('ensureReady bootstraps the WASM runtime exactly once, then creates the engine once', async () => {
    await litertProvider.ensureReady();
    await litertProvider.ensureReady();
    expect(loadLiteRtLm).toHaveBeenCalledTimes(1);
    expect(loadLiteRtLm).toHaveBeenCalledWith('/litert/litertlm_wasm_internal.js');
    expect(engineCreate).toHaveBeenCalledTimes(1);
  });

  it('runStreaming creates a conversation with the system preface and yields text chunks', async () => {
    let out = '';
    for await (const c of litertProvider.runStreaming({ systemPrompt: 'sys', userPrompt: 'u' })) out += c;
    expect(out).toBe('Hello');
    expect(engine.createConversation).toHaveBeenCalledWith({ preface: { messages: [{ role: 'system', content: 'sys' }] } });
    expect(conversation.sendMessageStreaming).toHaveBeenCalledWith('u');
  });

  it('normalizes a GPU device-lost failure during init and resets so a retry re-creates', async () => {
    engineCreate.mockReset();
    engineCreate.mockRejectedValueOnce(new Error('Device was lost. This can happen due to insufficient memory.'));
    await expect(litertProvider.ensureReady()).rejects.toThrow(/on-device AI could not start/i);
    engineCreate.mockResolvedValueOnce(engine);
    await litertProvider.ensureReady();
    expect(engineCreate).toHaveBeenCalledTimes(2);
  });

  it('runStreaming calls conversation.cancel() when the signal aborts', async () => {
    const controller = new AbortController();
    conversation.sendMessageStreaming.mockReturnValue(makeReadableStream([
      { role: 'assistant', content: [{ type: 'text', text: 'x' }] },
    ]));
    const drained: string[] = [];
    for await (const c of litertProvider.runStreaming({ systemPrompt: 's', userPrompt: 'u', signal: controller.signal })) {
      drained.push(c);
      controller.abort();
    }
    expect(conversationCancel).toHaveBeenCalled();
  });

  it('getAvailability reflects readiness from settings', async () => {
    expect(await litertProvider.getAvailability()).toBe('available');
  });
});
