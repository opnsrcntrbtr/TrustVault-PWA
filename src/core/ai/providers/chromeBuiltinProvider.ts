/**
 * Chrome built-in AI provider — wraps the global `LanguageModel` (Gemini Nano).
 * THE ONLY module that calls LanguageModel.create()/promptStreaming().
 * Desktop-only; never downloads a model (ensureReady is a no-op).
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import type { AiProvider, AiLanguageHints, AiRunParams, ChatSession } from '@/core/ai/providers/types';

interface AiSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
  clone?(): Promise<AiSession>;
  destroy(): void;
}
interface CreateOpts {
  initialPrompts: Array<{ role: 'system'; content: string }>;
  temperature?: number;
  topK?: number;
  expectedInputs?: Array<{ type: 'text'; languages?: string[] }>;
  expectedOutputs?: Array<{ type: 'text'; languages?: string[] }>;
}
interface LanguageModelStatic {
  create(opts: CreateOpts): Promise<AiSession>;
  availability(): Promise<AiAvailability>;
}

function buildCreateOpts(
  systemPrompt: string,
  params?: AiRunParams,
  languages?: AiLanguageHints,
): CreateOpts {
  const opts: CreateOpts = { initialPrompts: [{ role: 'system', content: systemPrompt }] };
  if (params?.temperature !== undefined) opts.temperature = params.temperature;
  if (params?.topK !== undefined) opts.topK = params.topK;
  if (languages?.expectedInputLanguages) {
    opts.expectedInputs = [{ type: 'text', languages: languages.expectedInputLanguages }];
  }
  if (languages?.outputLanguage) {
    opts.expectedOutputs = [{ type: 'text', languages: [languages.outputLanguage] }];
  }
  return opts;
}

function hasCustomOpts(params?: AiRunParams, languages?: AiLanguageHints): boolean {
  return Boolean(params?.temperature !== undefined || params?.topK !== undefined
    || languages?.expectedInputLanguages || languages?.outputLanguage);
}

function getLanguageModel(): LanguageModelStatic {
  const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
  if (!lm || typeof lm.create !== 'function') {
    throw new Error('Chrome built-in AI (LanguageModel) is not available');
  }
  return lm;
}

const baseSessions = new Map<string, AiSession>();
const initializingSessions = new Map<string, Promise<AiSession>>();

export function __clearChromeSessionCacheForTesting(): void {
  baseSessions.clear();
  initializingSessions.clear();
}

async function warmUp(systemPrompt: string): Promise<void> {
  if (baseSessions.has(systemPrompt)) return;
  if (initializingSessions.has(systemPrompt)) { await initializingSessions.get(systemPrompt); return; }
  const lm = getLanguageModel();
  const initPromise = lm.create({ initialPrompts: [{ role: 'system', content: systemPrompt }] })
    .then((session) => { baseSessions.set(systemPrompt, session); initializingSessions.delete(systemPrompt); return session; })
    .catch((err: unknown) => { initializingSessions.delete(systemPrompt); throw err; });
  initializingSessions.set(systemPrompt, initPromise);
  await initPromise;
}

async function getClonedSession(systemPrompt: string): Promise<AiSession> {
  await warmUp(systemPrompt);
  const baseSession = baseSessions.get(systemPrompt);
  if (!baseSession) throw new Error('Failed to warm up base session');
  if (typeof baseSession.clone === 'function') return await baseSession.clone();
  const lm = getLanguageModel();
  return await lm.create({ initialPrompts: [{ role: 'system', content: systemPrompt }] });
}

async function* runStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
  params?: AiRunParams; languages?: AiLanguageHints;
}): AsyncIterableIterator<string> {
  const session = hasCustomOpts(args.params, args.languages)
    ? await getLanguageModel().create(buildCreateOpts(args.systemPrompt, args.params, args.languages))
    : await getClonedSession(args.systemPrompt);
  try {
    const opts = args.signal ? { signal: args.signal } : undefined;
    for await (const chunk of session.promptStreaming(args.userPrompt, opts)) {
      yield chunk;
    }
  } finally {
    session.destroy();
  }
}

async function createChatSession(
  systemPrompt: string,
  opts?: { params?: AiRunParams; languages?: AiLanguageHints },
): Promise<ChatSession> {
  const session = hasCustomOpts(opts?.params, opts?.languages)
    ? await getLanguageModel().create(buildCreateOpts(systemPrompt, opts?.params, opts?.languages))
    : await getClonedSession(systemPrompt); // persistent for the whole conversation
  let destroyed = false;
  return {
    async *send(userText: string, signal?: AbortSignal): AsyncIterableIterator<string> {
      if (destroyed) throw new Error('Chat session destroyed');
      const opts = signal ? { signal } : undefined;
      for await (const chunk of session.promptStreaming(userText, opts)) yield chunk;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      session.destroy();
    },
  };
}

export const chromeBuiltinProvider: AiProvider = {
  id: 'chrome-builtin',
  supports(): boolean { return true; },
  async getAvailability(): Promise<AiAvailability> {
    const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
    if (!lm || typeof lm.availability !== 'function') return 'unavailable';
    try { return await lm.availability(); } catch { return 'unavailable'; }
  },
  ensureReady(): Promise<void> { return Promise.resolve(); },
  warmUp,
  runStreaming,
  createChatSession,
};
