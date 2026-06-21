import { describe, it, expect } from 'vitest';
import { trimChatMessages, MAX_CHAT_TURNS } from '@/core/ai/chat/chatTrim';

describe('trimChatMessages', () => {
  it('keeps the system message and the last N non-system messages', () => {
    const msgs = [
      { role: 'system', content: 's' },
      { role: 'user', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'user', content: '3' },
      { role: 'assistant', content: '4' },
    ];
    trimChatMessages(msgs, 2);
    expect(msgs.map((m) => m.content)).toEqual(['s', '3', '4']);
  });

  it('is a no-op when within budget', () => {
    const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: '1' }];
    trimChatMessages(msgs, 4);
    expect(msgs).toHaveLength(2);
  });

  it('handles no leading system message', () => {
    const msgs = [{ role: 'user', content: '1' }, { role: 'assistant', content: '2' }, { role: 'user', content: '3' }];
    trimChatMessages(msgs, 2);
    expect(msgs.map((m) => m.content)).toEqual(['2', '3']);
  });

  it('exposes a positive default turn budget', () => {
    expect(MAX_CHAT_TURNS).toBeGreaterThan(0);
  });
});
