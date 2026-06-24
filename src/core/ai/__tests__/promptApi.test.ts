import { describe, it, expect, afterEach, vi } from 'vitest';
import { runPrompt, runPromptStreaming, createChatSession } from '@/core/ai/promptApi';
import { __setActiveProviderForTesting, __resetRegistryForTesting } from '@/core/ai/providers/registry';
import type { AiProvider } from '@/core/ai/providers/types';

function fakeProvider(chunks: string[]): AiProvider {
  return {
    id: 'chrome-builtin',
    supports: () => true,
    getAvailability: vi.fn().mockResolvedValue('available'),
    ensureReady: vi.fn().mockResolvedValue(undefined),
    warmUp: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/require-await -- async generator stub, no await needed
    runStreaming: async function* () { for (const c of chunks) yield c; },
    createChatSession: vi.fn(),
  };
}

describe('promptApi delegation', () => {
  afterEach(() => { __resetRegistryForTesting(); vi.restoreAllMocks(); });

  it('runPrompt concatenates streamed chunks from the active provider', async () => {
    __setActiveProviderForTesting(fakeProvider(['Hello ', 'world']));
    expect(await runPrompt({ systemPrompt: 's', userPrompt: 'u' })).toBe('Hello world');
  });

  it('runPromptStreaming yields chunks from the active provider', async () => {
    __setActiveProviderForTesting(fakeProvider(['a', 'b']));
    let out = ''; for await (const c of runPromptStreaming({ systemPrompt: 's', userPrompt: 'u' })) out += c;
    expect(out).toBe('ab');
  });

  it('throws when no provider is active', async () => {
    __setActiveProviderForTesting(null);
    await expect(runPrompt({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(/no on-device ai provider/i);
  });

  it('createChatSession delegates to the active provider', async () => {
    const fakeSession = { send: vi.fn(), destroy: vi.fn() };
    const provider = fakeProvider([]);
    const createChatSessionMock = vi.fn().mockResolvedValue(fakeSession);
    provider.createChatSession = createChatSessionMock;
    __setActiveProviderForTesting(provider);

    const session = await createChatSession('sys');
    expect(createChatSessionMock).toHaveBeenCalledWith('sys');
    expect(session).toBe(fakeSession);
  });

  it('createChatSession returns null when no provider is available', async () => {
    __setActiveProviderForTesting(null);
    expect(await createChatSession('sys')).toBeNull();
  });
});
