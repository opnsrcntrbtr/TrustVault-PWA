/**
 * LiteRT-LM provider — fully-local WebGPU inference via @litert-lm/core.
 * Library is lazy-imported (heavy WASM) and never loaded on desktop Chrome.
 * The WASM runtime itself is self-hosted under /litert/ (see
 * scripts/copy-litert-assets.js) — the package's default bootstrap path
 * fetches ~37MB from cdn.jsdelivr.net, which this project does not allowlist.
 * Model weights download once from HuggingFace (gated by Settings opt-in).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiDownloadProgress, ChatSession } from '@/core/ai/providers/types';
import { hasWebGpu } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getLitertModelById } from '@/core/ai/litertModels';
import { isDeviceLostError, DEVICE_UNAVAILABLE_MESSAGE } from '@/core/ai/providers/gpuErrors';

const LITERT_WASM_PATH = '/litert/litertlm_wasm_internal.js';

interface LitertMessageContentItem {
  type: string;
  text?: string;
}
interface LitertMessage {
  role: string;
  content?: string | LitertMessageContentItem[];
}
interface LitertConversation {
  sendMessageStreaming(message: string): ReadableStream<LitertMessage>;
  cancel(): void;
  delete(): Promise<void>;
}
interface LitertEngine {
  createConversation(config: { preface: { messages: Array<{ role: 'system'; content: string }> } }): Promise<LitertConversation>;
  delete(): Promise<void>;
}

let wasmLoaded = false;
let wasmLoadPromise: Promise<void> | null = null;
let engine: LitertEngine | null = null;
let engineModelId: string | null = null;
let initPromise: Promise<LitertEngine> | null = null;

export function __resetLitertEngineForTesting(): void {
  wasmLoaded = false; wasmLoadPromise = null;
  engine = null; engineModelId = null; initPromise = null;
}

/** Drops all engine state so the next ensureReady() re-creates from scratch. */
function resetEngineState(): void {
  engine = null; engineModelId = null; initPromise = null;
}

/** Unloads the engine (frees GPU/WASM memory) so a different model can be picked. */
export async function removeLitertModel(): Promise<void> {
  if (engine) await engine.delete();
  engine = null; engineModelId = null; initPromise = null;
}

async function ensureWasmLoaded(): Promise<void> {
  if (wasmLoaded) return;
  if (wasmLoadPromise) { await wasmLoadPromise; return; }
  const { loadLiteRtLm } = await import('@litert-lm/core');
  wasmLoadPromise = loadLiteRtLm(LITERT_WASM_PATH).then(() => { wasmLoaded = true; });
  await wasmLoadPromise;
}

/**
 * Fetches the model ourselves (instead of passing a bare URL to Engine.create)
 * so download progress can be reported — @litert-lm/core has no progress
 * callback, but EngineSettings.model accepts a ReadableStream<Uint8Array>.
 */
async function fetchModelWithProgress(
  url: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok || !response.body) throw new Error(`Failed to fetch LiteRT model from ${url}`);
  const total = Number(response.headers.get('content-length') ?? 0);
  let loaded = 0;
  const reader = response.body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      loaded += value.byteLength;
      onProgress?.({ progress: total > 0 ? loaded / total : 0, text: 'Downloading model' });
      controller.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function createEngine(
  modelId: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<LitertEngine> {
  await ensureWasmLoaded();
  const { Engine } = await import('@litert-lm/core');
  const model = getLitertModelById(modelId);
  if (!model) throw new Error(`Unknown LiteRT model id: ${modelId}`);
  const modelStream = await fetchModelWithProgress(model.url, onProgress);
  const created = await Engine.create({ model: modelStream });
  return created as unknown as LitertEngine;
}

async function ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void> {
  const modelId = loadAiSettings().litertModelId;
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
  if (!engine) throw new Error('LiteRT-LM engine not ready');
  const conversation = await engine.createConversation({
    preface: { messages: [{ role: 'system', content: args.systemPrompt }] },
  });
  const onAbort = () => { conversation.cancel(); };
  args.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const stream = conversation.sendMessageStreaming(args.userPrompt);
    const reader = stream.getReader();
    try {
      let result = await reader.read();
      while (!result.done) {
        const items = Array.isArray(result.value.content) ? result.value.content : [];
        for (const item of items) {
          if (item.type === 'text' && item.text) yield item.text;
        }
        result = await reader.read();
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err: unknown) {
    if (isDeviceLostError(err)) { resetEngineState(); throw new Error(DEVICE_UNAVAILABLE_MESSAGE); }
    throw err;
  } finally {
    args.signal?.removeEventListener('abort', onAbort);
    await conversation.delete();
  }
}

async function createChatSession(systemPrompt: string): Promise<ChatSession> {
  await ensureReady();
  if (!engine) throw new Error('LiteRT-LM engine not ready');
  const conversation = await engine.createConversation({
    preface: { messages: [{ role: 'system', content: systemPrompt }] },
  });
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      const onAbort = () => { conversation.cancel(); };
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const stream = conversation.sendMessageStreaming(userText);
        const reader = stream.getReader();
        try {
          let result = await reader.read();
          while (!result.done) {
            const items = Array.isArray(result.value.content) ? result.value.content : [];
            for (const item of items) {
              if (item.type === 'text' && item.text) yield item.text;
            }
            result = await reader.read();
          }
        } finally {
          reader.releaseLock();
        }
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
      void conversation.delete();
    },
  };
}

export const litertProvider: AiProvider = {
  id: 'litert-lm',
  async getAvailability(): Promise<AiAvailability> {
    if (!(await hasWebGpu())) return 'unavailable';
    return loadAiSettings().litertModelReady ? 'available' : 'downloadable';
  },
  ensureReady,
  warmUp(): Promise<void> { return ensureReady(); },
  runStreaming,
  createChatSession,
};
