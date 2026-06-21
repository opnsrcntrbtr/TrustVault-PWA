/**
 * WebLLM provider — fully-local WebGPU inference via @mlc-ai/web-llm.
 * Library is lazy-imported (heavy WASM) and never loaded on desktop Chrome.
 * Weights download once from the MLC/HF CDN (gated by Settings opt-in).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiDownloadProgress } from '@/core/ai/providers/types';
import { hasWebGpu } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';

interface MlcEngine {
  chat: { completions: { create(opts: {
    messages: Array<{ role: 'system' | 'user'; content: string }>;
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

/**
 * User-facing message when the GPU can't sustain WebLLM. Seen on low-end /
 * older mobile GPUs (e.g. some Android 10 + Adreno 6xx drivers) that lose the
 * WebGPU device during engine warm-up regardless of model size.
 */
const DEVICE_UNAVAILABLE_MESSAGE =
  "On-device AI could not start on this device's GPU. It may not support running this model.";

/**
 * True for WebGPU device-loss / dropped-instance failures, which cascade once
 * the GPU device is gone. We normalize these into one clean error and reset the
 * engine, instead of letting WebLLM's internal rejections flood the console.
 */
function isDeviceLostError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /device was lost|external instance reference|poperrorscope|gpudevice|device is lost/i.test(msg);
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

export const webllmProvider: AiProvider = {
  id: 'webllm',
  async getAvailability(): Promise<AiAvailability> {
    if (!(await hasWebGpu())) return 'unavailable';
    return loadAiSettings().mobileAiModelReady ? 'available' : 'downloadable';
  },
  ensureReady,
  warmUp(): Promise<void> { return ensureReady(); },
  runStreaming,
};
