import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPrompt = vi.fn();
vi.mock('@/core/ai/promptApi', () => ({
  runPrompt: (...a: unknown[]): unknown => runPrompt(...a),
}));

import {
  buildStrengthPrompt,
  explainStrength,
  STRENGTH_SYSTEM_PROMPT,
} from '@/core/ai/strengthExplain';

describe('strengthExplain', () => {
  beforeEach(() => runPrompt.mockReset());

  it('prompt contains the strength label and entropy', () => {
    const p = buildStrengthPrompt({ strength: 'strong', entropyBits: 82 });
    expect(p).toContain('strong');
    expect(p).toContain('82');
  });

  it('prompt and system prompt leak no secret-shaped data', () => {
    const p = buildStrengthPrompt({ strength: 'weak', entropyBits: 12 });
    const combined = `${STRENGTH_SYSTEM_PROMPT}\n${p}`.toLowerCase();
    for (const forbidden of ['password:', 'username', 'http', '://', 'secret', 'token']) {
      expect(combined).not.toContain(forbidden);
    }
  });

  it('rounds entropy to an integer in the prompt', () => {
    const p = buildStrengthPrompt({ strength: 'medium', entropyBits: 47.8 });
    expect(p).toContain('48');
    expect(p).not.toContain('47.8');
  });

  it('explainStrength delegates to runPrompt and returns its text', async () => {
    runPrompt.mockResolvedValue('Because it is long.');
    const result = await explainStrength({ strength: 'very-strong', entropyBits: 120 });
    expect(result).toBe('Because it is long.');
    expect(runPrompt).toHaveBeenCalledOnce();
    const arg = runPrompt.mock.calls[0][0] as { systemPrompt: string; userPrompt: string };
    expect(arg.systemPrompt).toBe(STRENGTH_SYSTEM_PROMPT);
    expect(arg.userPrompt).toContain('very-strong');
  });
});
