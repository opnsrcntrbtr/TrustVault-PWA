/**
 * WebLLM provider — fully-local WebGPU inference via @mlc-ai/web-llm.
 * Library is lazy-imported (heavy WASM) and never loaded on desktop Chrome.
 * Weights download once from the MLC/HF CDN (gated by Settings opt-in).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiDownloadProgress, ChatSession } from '@/core/ai/providers/types';
import { hasWebGpu } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';
import { trimChatMessages, MAX_CHAT_TURNS } from '@/core/ai/chat/chatTrim';

interface MlcEngine {
  chat: { completions: { create(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    stream: true;
  }): Promise<AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>> } };
  interruptGenerate(): void;
  resetChat(): Promise<void>;
  unload(): Promise<void>;
}

let engine: MlcEngine | null = null;
let engineModelId: string | null = null;
let initPromise: Promise<MlcEngine> | null = null;

export function __resetWebllmEngineForTesting(): void {
  engine = null; engineModelId = null; initPromise = null;
}

/** Drops all engine state so the next ensureReady() re-creates from scratch. */
function resetEngineState(): void {
  engine = null; engineModelId = null; initPromise = null;
}

/** Unloads the engine (frees GPU/WASM memory) so a different model can be picked. */
export async function removeWebllmModel(): Promise<void> {
  if (engine) await engine.unload();
  engine = null; engineModelId = null; initPromise = null;
}

async function createEngine(
  modelId: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<MlcEngine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  // Both AI surfaces send short prompts (strength rating / breach metadata), so
  // a large context is unnecessary. Capping context_window_size keeps the
  // warm-up KV-cache allocation small — this avoids the GPU device-loss seen on
  // low-end/older mobile GPUs (e.g. Adreno 6xx) where the model's default
  // context blows the warm-up memory budget.
  const created = await CreateMLCEngine(
    modelId,
    {
      initProgressCallback: (r: { progress: number; text: string }) => {
        onProgress?.({ progress: r.progress, text: r.text });
      },
    },
    { context_window_size: 2048 },
  );
  return created as unknown as MlcEngine;
}

async function ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void> {
  const modelId = loadAiSettings().webLlmModelId;
  if (engine && engineModelId === modelId) return;
  if (initPromise) { await initPromise; return; }
  try { await navigator.storage.persist(); } catch { /* best-effort */ }
  initPromise = createEngine(modelId, onProgress)
    .then((e) => { engine = e; engineModelId = modelId; initPromise = null; return e; })
    .catch((err: unknown) => {
      resetEngineState();
      if (isDeviceLostError(err)) throw new Error(DEVICE_UNAVAILABLE_MESSAGE);
      throw err;
    });
  await initPromise;
}

async function* runStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  await ensureReady();
  if (!engine) throw new Error('WebLLM engine not ready');
  await engine.resetChat();
  const onAbort = () => { engine?.interruptGenerate(); };
  args.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const stream = await engine.chat.completions.create({
      stream: true,
      messages: [
        { role: 'system', content: args.systemPrompt },
        { role: 'user', content: args.userPrompt },
      ],
    });
    for await (const chunk of stream) {
      const piece = chunk.choices[0]?.delta.content;
      if (piece) yield piece;
    }
  } catch (err: unknown) {
    // A device-loss mid-generation leaves the engine wedged — reset it so the
    // next attempt re-creates, and surface one clean error instead of cascade.
    if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
    throw err;
  } finally {
    args.signal?.removeEventListener('abort', onAbort);
  }
}

type ChatRoleMsg = { role: 'system' | 'user' | 'assistant'; content: string };

async function createChatSession(systemPrompt: string): Promise<ChatSession> {
  await Promise.resolve();
  const messages: ChatRoleMsg[] = [{ role: 'system', content: systemPrompt }];
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      await ensureReady();
      if (!engine) throw new Error('WebLLM engine not ready');
      messages.push({ role: 'user', content: userText });
      trimChatMessages(messages, MAX_CHAT_TURNS);
      const onAbort = () => { engine?.interruptGenerate(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      let assistant = '';
      try {
        const stream = await engine.chat.completions.create({ stream: true, messages: [...messages] });
        for await (const chunk of stream) {
          const piece = chunk.choices[0]?.delta.content;
          if (piece) { assistant += piece; yield piece; }
        }
        messages.push({ role: 'assistant', content: assistant });
      } catch (err: unknown) {
        if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
        throw err;
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      messages.length = 0;
    },
  };
}

export const webllmProvider: AiProvider = {
  id: 'webllm',
  async getAvailability(): Promise<AiAvailability> {
    if (!(await hasWebGpu())) return 'unavailable';
    return loadAiSettings().mobileAiModelReady ? 'available' : 'downloadable';
  },
  ensureReady,
  warmUp(): Promise<void> { return ensureReady(); },
  runStreaming,
  createChatSession,
};
