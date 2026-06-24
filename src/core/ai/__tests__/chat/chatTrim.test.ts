import { describe, it, expect } from 'vitest';
import { trimChatMessages, MAX_CHAT_TURNS, checkChatUsage } from '@/core/ai/chat/chatTrim';

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

describe('checkChatUsage', () => {
  it('returns null when measureUsage is absent', async () => {
    expect(await checkChatUsage({}, 'hi')).toBeNull();
  });
  it('flags nearLimit past the threshold', async () => {
    const session = { measureUsage: () => Promise.resolve({ usage: 900, quota: 1000 }) };
    expect(await checkChatUsage(session, 'hi', 0.8)).toEqual({ usage: 900, quota: 1000, nearLimit: true });
  });
  it('not nearLimit below threshold', async () => {
    const session = { measureUsage: () => Promise.resolve({ usage: 100, quota: 1000 }) };
    expect(await checkChatUsage(session, 'hi', 0.8)).toEqual({ usage: 100, quota: 1000, nearLimit: false });
  });
  it('returns null when measureUsage resolves to null', async () => {
    const session = { measureUsage: () => Promise.resolve(null) };
    expect(await checkChatUsage(session, 'hi')).toBeNull();
  });
  it('returns null when quota is non-positive', async () => {
    const session = { measureUsage: () => Promise.resolve({ usage: 0, quota: 0 }) };
    expect(await checkChatUsage(session, 'hi')).toBeNull();
  });
});
