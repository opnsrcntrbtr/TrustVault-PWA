import { useCallback, useEffect, useRef, useState } from 'react';
import { createChatSession, warmUpAi } from '@/core/ai/promptApi';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import type { ChatSession } from '@/core/ai/providers/types';
import type { ChatMessage } from '@/core/ai/chat/chatTypes';
import { useAuthStore } from '@/presentation/store/authStore';

export interface UseAiChatOptions {
  systemPrompt: string;
  seedMessages?: ChatMessage[];
  autoEnable?: boolean;
}
export interface UseAiChat {
  enabled: boolean;
  messages: ChatMessage[];
  streaming: boolean;
  error: boolean;
  send: (text: string) => Promise<void>;
  stop: () => void;
  retry: () => void;
  reset: () => void;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAiChat(opts: UseAiChatOptions): UseAiChat {
  const { systemPrompt, seedMessages } = opts;
  const [enabled, setEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages ?? []);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(false);

  const sessionRef = useRef<ChatSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserRef = useRef<string | null>(null);
  const isLocked = useAuthStore((s) => s.isLocked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const teardown = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.destroy();
    sessionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    teardown();
    setMessages([]);
    setStreaming(false);
    setError(false);
  }, [teardown]);

  // Availability + warm-up.
  useEffect(() => {
    let mounted = true;
    getAiAvailability()
      .then((a) => {
        if (mounted && isFeatureUsable(a)) {
          setEnabled(true);
          warmUpAi(systemPrompt).catch(console.error);
        }
      })
      .catch(() => { if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, [systemPrompt]);

  // Force-teardown on lock / logout transitions (not on initial mount — a
  // caller-provided seedMessages transcript must survive mounting before the
  // auth store has settled).
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (hasMountedRef.current && (isLocked || !isAuthenticated)) reset();
    hasMountedRef.current = true;
  }, [isLocked, isAuthenticated, reset]);

  // Teardown on unmount.
  useEffect(() => () => { teardown(); }, [teardown]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    lastUserRef.current = trimmed;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(false);
    setStreaming(true);
    const userMsg: ChatMessage = { id: newId(), role: 'user', content: trimmed };
    const assistantMsg: ChatMessage = { id: newId(), role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      if (!sessionRef.current) {
        sessionRef.current = await createChatSession(systemPrompt);
      }
      if (!sessionRef.current) throw new Error('No on-device AI provider available');
      let acc = '';
      for await (const chunk of sessionRef.current.send(trimmed, controller.signal)) {
        acc += chunk;
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // keep partial assistant text; no error state
      } else {
        console.error('AI chat error:', err);
        setError(true);
      }
    } finally {
      if (abortRef.current === controller) {
        setStreaming(false);
        abortRef.current = null;
      }
    }
  }, [systemPrompt]);

  const retry = useCallback(() => {
    if (lastUserRef.current) void send(lastUserRef.current);
  }, [send]);

  return { enabled, messages, streaming, error, send, stop, retry, reset };
}
