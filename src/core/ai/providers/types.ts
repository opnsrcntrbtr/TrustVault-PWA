/**
 * Provider abstraction for on-device AI inference backends.
 * Generalizes the former single-backend promptApi.ts so the inference
 * engine (Chrome built-in vs WebLLM) is swappable behind one interface.
 */
import type { AiAvailability } from '@/core/ai/aiTypes';

export type AiProviderId = 'chrome-builtin' | 'webllm' | 'litert-lm';

export interface AiDownloadProgress {
  /** Normalized 0..1 download/initialization progress. */
  progress: number;
  /** Optional human-readable status, e.g. "Fetching weights". */
  text?: string;
}

export interface ChatSession {
  /** Stream the assistant's reply to one user turn. */
  send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string>;
  /** Free native resources / clear transcript. Idempotent. */
  destroy(): void;
}

export interface AiProvider {
  readonly id: AiProviderId;
  /** Cheap, read-only capability probe. MUST NOT trigger a download. */
  getAvailability(): Promise<AiAvailability>;
  /** Ensure the model is usable. No-op for chrome-builtin; downloads for webllm. */
  ensureReady(onProgress?: (p: AiDownloadProgress) => void): Promise<void>;
  /** Prime a base session/engine for a system prompt (latency optimization). */
  warmUp(systemPrompt: string): Promise<void>;
  /** Stream a completion as text chunks. */
  runStreaming(args: {
    systemPrompt: string;
    userPrompt: string;
    signal?: AbortSignal;
  }): AsyncIterableIterator<string>;
  /** Create a multi-turn session primed with a (pre-inspected) system prompt. */
  createChatSession(systemPrompt: string): Promise<ChatSession>;
}
