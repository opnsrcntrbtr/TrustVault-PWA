import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseStrengthInsight, explainStrengthStructured } from '@/core/ai/strengthExplain';

vi.mock('@/core/ai/promptApi', () => ({
  runStructured: vi.fn(),
}));
import { runStructured } from '@/core/ai/promptApi';

afterEach(() => vi.clearAllMocks());

describe('parseStrengthInsight', () => {
  it('parses a valid insight', () => {
    const out = parseStrengthInsight('{"severity":"high","factors":["short"],"rankedActions":["lengthen"]}');
    expect(out).toEqual({ severity: 'high', factors: ['short'], rankedActions: ['lengthen'] });
  });
  it('returns null on malformed json', () => {
    expect(parseStrengthInsight('not json')).toBeNull();
  });
  it('returns null when severity is invalid', () => {
    expect(parseStrengthInsight('{"severity":"nope","factors":[],"rankedActions":[]}')).toBeNull();
  });
});

describe('explainStrengthStructured', () => {
  it('returns typed insight on success', async () => {
    vi.mocked(runStructured).mockResolvedValue('{"severity":"medium","factors":["ok"],"rankedActions":["add length"]}');
    const r = await explainStrengthStructured({ strength: 'medium', entropyBits: 50 });
    expect(r).toEqual({ insight: { severity: 'medium', factors: ['ok'], rankedActions: ['add length'] } });
  });
  it('falls back to raw on validation failure', async () => {
    vi.mocked(runStructured).mockResolvedValue('garbage');
    const r = await explainStrengthStructured({ strength: 'weak', entropyBits: 20 });
    expect(r).toEqual({ raw: 'garbage' });
  });

  it('passes the locale-resolved output language to runStructured', async () => {
    vi.mocked(runStructured).mockResolvedValue('{"severity":"low","factors":[],"rankedActions":[]}');
    Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
    await explainStrengthStructured({ strength: 'strong', entropyBits: 80 });
    expect(vi.mocked(runStructured)).toHaveBeenCalledWith(
      expect.objectContaining({ languages: { expectedInputLanguages: ['en'], outputLanguage: 'es' } }),
    );
  });
});
