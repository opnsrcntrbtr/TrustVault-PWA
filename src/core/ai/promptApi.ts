/**
 * Thin wrapper over the Chrome built-in AI global `LanguageModel`.
 * THE ONLY module that calls create()/promptStreaming(). Isolates API drift.
 * Callers MUST confirm availability === 'available' first (never-download policy).
 */

interface AiSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
  /** Optional: not all LanguageModel runtimes expose clone(); callers must fall back. */
  clone?(): Promise<AiSession>;
  destroy(): void;
}

interface LanguageModelStatic {
  create(opts: { initialPrompts: Array<{ role: 'system'; content: string }> }): Promise<AiSession>;
}

function getLanguageModel(): LanguageModelStatic {
  const lm = (globalThis as Record<string, unknown>).LanguageModel as LanguageModelStatic | undefined;
  if (!lm || typeof lm.create !== 'function') {
    throw new Error('Chrome built-in AI (LanguageModel) is not available');
  }
  return lm;
}

// Cache of base sessions mapped by systemPrompt
const baseSessions = new Map<string, AiSession>();
const initializingSessions = new Map<string, Promise<AiSession>>();

export function __clearSessionCacheForTesting(): void {
  baseSessions.clear();
  initializingSessions.clear();
}

/**
 * Initializes a base session for the given system prompt in the background.
 * If already initialized or initializing, this is a fast no-op or waits for completion.
 */
export async function warmUpAi(systemPrompt: string): Promise<void> {
  if (baseSessions.has(systemPrompt)) {
    return;
  }
  if (initializingSessions.has(systemPrompt)) {
    await initializingSessions.get(systemPrompt);
    return;
  }

  const lm = getLanguageModel();
  const initPromise = lm.create({
    initialPrompts: [{ role: 'system', content: systemPrompt }],
  }).then((session) => {
    baseSessions.set(systemPrompt, session);
    initializingSessions.delete(systemPrompt);
    return session;
  }).catch((err: unknown) => {
    initializingSessions.delete(systemPrompt);
    throw err;
  });

  initializingSessions.set(systemPrompt, initPromise);
  await initPromise;
}

async function getClonedSession(systemPrompt: string): Promise<AiSession> {
  await warmUpAi(systemPrompt);
  const baseSession = baseSessions.get(systemPrompt);
  if (!baseSession) {
    throw new Error('Failed to warm up base session');
  }
  // Prefer cloning the pristine base session (system-prompt-only context) so each
  // call starts from clean state and never inherits a prior prompt's data.
  // Fall back to a fresh session if this runtime's LanguageModel lacks clone().
  if (typeof baseSession.clone === 'function') {
    return await baseSession.clone();
  }
  const lm = getLanguageModel();
  return await lm.create({
    initialPrompts: [{ role: 'system', content: systemPrompt }],
  });
}

export async function runPrompt(args: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const session = await getClonedSession(args.systemPrompt);
  try {
    let text = '';
    const opts = args.signal ? { signal: args.signal } : undefined;
    for await (const chunk of session.promptStreaming(args.userPrompt, opts)) {
      text += chunk;
    }
    return text;
  } finally {
    session.destroy();
  }
}

export async function* runPromptStreaming(args: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  const session = await getClonedSession(args.systemPrompt);
  try {
    const opts = args.signal ? { signal: args.signal } : undefined;
    for await (const chunk of session.promptStreaming(args.userPrompt, opts)) {
      yield chunk;
    }
  } finally {
    session.destroy();
  }
}
