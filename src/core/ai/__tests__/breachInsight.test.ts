import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseBreachInsight, explainBreachImpactStructured } from '@/core/ai/breachImpactExplain';
import type { BreachImpactExplainInput } from '@/core/ai/breachImpactExplain';

vi.mock('@/core/ai/promptApi', () => ({ runStructured: vi.fn() }));
import { runStructured } from '@/core/ai/promptApi';

afterEach(() => vi.clearAllMocks());

const input: BreachImpactExplainInput = {
  breaches: [{ title: 'X', dataClasses: ['Emails'] }] as never,
  credentialTitle: 'Bank',
};

describe('parseBreachInsight', () => {
  it('parses valid', () => {
    expect(parseBreachInsight('{"riskLevel":"critical","exposedData":["Emails"],"steps":["change pw"]}'))
      .toEqual({ riskLevel: 'critical', exposedData: ['Emails'], steps: ['change pw'] });
  });
  it('null on invalid riskLevel', () => {
    expect(parseBreachInsight('{"riskLevel":"meh","exposedData":[],"steps":[]}')).toBeNull();
  });
  it('null on malformed json', () => {
    expect(parseBreachInsight('{')).toBeNull();
  });
});

describe('explainBreachImpactStructured', () => {
  it('returns typed insight', async () => {
    vi.mocked(runStructured).mockResolvedValue('{"riskLevel":"high","exposedData":["Emails"],"steps":["rotate"]}');
    const r = await explainBreachImpactStructured(input);
    expect(r).toEqual({ insight: { riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate'] } });
  });
  it('falls back to raw', async () => {
    vi.mocked(runStructured).mockResolvedValue('oops');
    expect(await explainBreachImpactStructured(input)).toEqual({ raw: 'oops' });
  });
});
