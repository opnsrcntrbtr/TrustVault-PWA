/**
 * Thin wrapper over the Chrome built-in AI global `LanguageModel`.
 * THE ONLY module that calls create()/promptStreaming(). Isolates API drift.
 * Callers MUST confirm availability === 'available' first (never-download policy).
 */

interface AiSession {
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): AsyncIterable<string>;
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

export async function runPrompt(args: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const lm = getLanguageModel();
  const session = await lm.create({
    initialPrompts: [{ role: 'system', content: args.systemPrompt }],
  });
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
