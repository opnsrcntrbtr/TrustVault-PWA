import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const createChatSession = vi.fn();
vi.mock('@/core/ai/promptApi', () => ({
  createChatSession: (s: string): unknown => createChatSession(s),
  warmUpAi: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('available'),
  isFeatureUsable: (a: string) => a === 'available',
}));

import { useAiChat } from '@/presentation/hooks/useAiChat';

function sessionStreaming(chunks: string[], measureUsage?: (text: string) => Promise<{ usage: number; quota: number } | null>) {
  return {
    send: vi.fn(() => (async function* () {
      await Promise.resolve();
      for (const c of chunks) yield c;
    })()),
    destroy: vi.fn(),
    ...(measureUsage ? { measureUsage } : {}),
  };
}

beforeEach(() => { createChatSession.mockReset(); });

describe('useAiChat', () => {
  it('becomes enabled when availability is usable', async () => {
    createChatSession.mockResolvedValue(sessionStreaming(['hi']));
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
  });

  it('send() appends a user turn then streams an assistant turn', async () => {
    createChatSession.mockResolvedValue(sessionStreaming(['Hel', 'lo']));
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => { await result.current.send('q'); });
    expect(result.current.messages.map((m) => `${m.role}:${m.content}`)).toEqual(['user:q', 'assistant:Hello']);
    expect(result.current.streaming).toBe(false);
  });

  it('seedMessages prime the transcript as the first assistant turn', () => {
    createChatSession.mockResolvedValue(sessionStreaming(['x']));
    const { result } = renderHook(() => useAiChat({
      systemPrompt: 'sys',
      seedMessages: [{ id: 's1', role: 'assistant', content: 'seeded' }],
    }));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe('seeded');
  });

  it('reset() destroys the session and clears messages', async () => {
    const session = sessionStreaming(['a']);
    createChatSession.mockResolvedValue(session);
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => { await result.current.send('q'); });
    act(() => { result.current.reset(); });
    expect(result.current.messages).toEqual([]);
    expect(session.destroy).toHaveBeenCalled();
  });

  it('sets usageWarning when the session reports near-limit usage', async () => {
    const session = sessionStreaming(['a'], () => Promise.resolve({ usage: 950, quota: 1000 }));
    createChatSession.mockResolvedValue(session);
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => { await result.current.send('q'); });
    expect(result.current.usageWarning).toBe(true);
  });

  it('does not set usageWarning when usage is well under quota', async () => {
    const session = sessionStreaming(['a'], () => Promise.resolve({ usage: 50, quota: 1000 }));
    createChatSession.mockResolvedValue(session);
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => { await result.current.send('q'); });
    expect(result.current.usageWarning).toBe(false);
  });

  it('reset() clears usageWarning', async () => {
    const session = sessionStreaming(['a'], () => Promise.resolve({ usage: 950, quota: 1000 }));
    createChatSession.mockResolvedValue(session);
    const { result } = renderHook(() => useAiChat({ systemPrompt: 'sys' }));
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => { await result.current.send('q'); });
    expect(result.current.usageWarning).toBe(true);
    act(() => { result.current.reset(); });
    expect(result.current.usageWarning).toBe(false);
  });
});
