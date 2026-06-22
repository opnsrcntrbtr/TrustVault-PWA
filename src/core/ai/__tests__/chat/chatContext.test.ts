import { describe, it, expect } from 'vitest';
import { assertNoSecrets, buildAssistantSystemPrompt } from '@/core/ai/chat/chatContext';

describe('assertNoSecrets', () => {
  it('throws when a password field is present', () => {
    expect(() => assertNoSecrets('password: hunter2')).toThrow(/safety invariant/i);
  });
  it('throws when a notes field is present', () => {
    expect(() => assertNoSecrets('Notes: my secret')).toThrow(/safety invariant/i);
  });
  it('passes for clean context', () => {
    expect(() => assertNoSecrets('Title: GitHub\nCategory: dev')).not.toThrow();
  });
});

describe('buildAssistantSystemPrompt', () => {
  it('stateless: emits the base prompt with no vault data', () => {
    const p = buildAssistantSystemPrompt('stateless');
    expect(p).toContain('no access');
    expect(p).not.toContain('Title:');
  });

  it('curated: includes only aggregate counts, never secrets', () => {
    const p = buildAssistantSystemPrompt('curated', {
      aggregate: { total: 10, weak: 2, reused: 1, breached: 3, categories: { dev: 4 }, oldestPasswordAgeDays: 400 },
    });
    expect(p).toContain('10');
    expect(p).toContain('weak');
    expect(() => assertNoSecrets(p)).not.toThrow();
  });

  it('per-credential: includes safe fields only', () => {
    const p = buildAssistantSystemPrompt('per-credential', {
      credential: { title: 'GitHub', username: 'me', category: 'dev', ageDays: 30, breachCount: 1 },
    });
    expect(p).toContain('GitHub');
    expect(p).toContain('dev');
  });

  it('throws if a credential title smuggles a secret field', () => {
    expect(() => buildAssistantSystemPrompt('per-credential', {
      credential: { title: 'x\npassword: leak' },
    })).toThrow(/safety invariant/i);
  });
});
