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

async function createEngine(
  modelId: string,
  onProgress?: (p: AiDownloadProgress) => void,
): Promise<MlcEngine> {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  const created = await CreateMLCEngine(modelId, {
    initProgressCallback: (r: { progress: number; text: string }) => {
      onProgress?.({ progress: r.progress, text: r.text });
    },
  });
  return created as unknown as MlcEngine;
}

async function ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void> {
  const modelId = loadAiSettings().webLlmModelId;
  if (engine && engineModelId === modelId) return;
  if (initPromise) { await initPromise; return; }
  try { await navigator.storage.persist(); } catch { /* best-effort */ }
  initPromise = createEngine(modelId, onProgress)
    .then((e) => { engine = e; engineModelId = modelId; initPromise = null; return e; })
    .catch((err: unknown) => { initPromise = null; throw err; });
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
