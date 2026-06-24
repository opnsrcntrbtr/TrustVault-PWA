/**
 * Provider abstraction for on-device AI inference backends.
 * Generalizes the former single-backend promptApi.ts so the inference
 * engine (Chrome built-in vs WebLLM) is swappable behind one interface.
 */
import type { AiAvailability } from '@/core/ai/aiTypes';

export type AiProviderId = 'chrome-builtin' | 'webllm' | 'litert-lm';

/** Optional capabilities a provider may natively support. */
export type AiCapability = 'structured' | 'params' | 'quota' | 'languages';

/** Sampling parameters (native to chrome-builtin; ignored by other providers). */
export interface AiRunParams {
  temperature?: number;
  topK?: number;
}

/** Input/output language hints (native to chrome-builtin; ignored by other providers). */
export interface AiLanguageHints {
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

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
  /** Token usage/quota for a prospective input. null if unsupported. */
  measureUsage?(text: string): Promise<{ usage: number; quota: number } | null>;
}

export interface AiProvider {
  readonly id: AiProviderId;
  /** Whether this provider natively supports a given capability. */
  supports(cap: AiCapability): boolean;
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
    params?: AiRunParams;
    languages?: AiLanguageHints;
  }): AsyncIterableIterator<string>;
  /** Create a multi-turn session primed with a (pre-inspected) system prompt. */
  createChatSession(systemPrompt: string, opts?: {
    params?: AiRunParams;
    languages?: AiLanguageHints;
  }): Promise<ChatSession>;
}
