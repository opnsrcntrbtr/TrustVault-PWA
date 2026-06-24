/**
 * Public inference API. Delegates to the active provider (registry).
 * Kept as a stable facade so feature modules/hooks don't import providers directly.
 */
import { getActiveProvider } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider, __clearChromeSessionCacheForTesting } from '@/core/ai/providers/chromeBuiltinProvider';
import type { AiCapability, ChatSession } from '@/core/ai/providers/types';

/** Test seam retained for back-compat with existing suites. */
export function __clearSessionCacheForTesting(): void {
  __clearChromeSessionCacheForTesting();
}

export async function warmUpAi(systemPrompt: string): Promise<void> {
  const provider = await getActiveProvider();
  if (!provider) return;
  await provider.warmUp(systemPrompt);
}

export async function* runPromptStreaming(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): AsyncIterableIterator<string> {
  const provider = await getActiveProvider();
  if (!provider) throw new Error('No on-device AI provider available');
  yield* provider.runStreaming(args);
}

export async function runPrompt(args: {
  systemPrompt: string; userPrompt: string; signal?: AbortSignal;
}): Promise<string> {
  let text = '';
  for await (const chunk of runPromptStreaming(args)) text += chunk;
  return text;
}

export async function createChatSession(systemPrompt: string): Promise<ChatSession | null> {
  const provider = await getActiveProvider();
  if (!provider) return null;
  return provider.createChatSession(systemPrompt);
}

export async function supportsCapability(cap: AiCapability): Promise<boolean> {
  const provider = await getActiveProvider();
  return provider ? provider.supports(cap) : false;
}

// Re-export so `getActiveProvider()` fallback (Task 6) and tests can reach the
// chrome provider directly when needed.
export { chromeBuiltinProvider };
