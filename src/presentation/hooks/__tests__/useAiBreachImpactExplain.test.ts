import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { warmUpAi } from '@/core/ai/promptApi';

const loadAiSettings = vi.fn();
const getAiAvailability = vi.fn();
const explainBreachImpactStructured = vi.fn();

vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: (): unknown => loadAiSettings(),
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: (): unknown => getAiAvailability(),
  isFeatureUsable: (a: string): boolean => a === 'available',
}));
vi.mock('@/core/ai/breachImpactExplain', () => ({
  explainBreachImpactStructured: (...a: unknown[]): unknown => explainBreachImpactStructured(...a),
  BREACH_SYSTEM_PROMPT: 'mock-system-prompt',
}));
vi.mock('@/core/ai/promptApi', () => ({
  warmUpAi: vi.fn(() => Promise.resolve()),
}));

import { useAiBreachImpactExplain } from '@/presentation/hooks/useAiBreachImpactExplain';

const input = { breaches: [], credentialTitle: 'Bank' } as never;

function bothOn() {
  loadAiSettings.mockReturnValue({ enableOnDeviceAI: true, allowBreachImpactAnalysis: true });
}

describe('useAiBreachImpactExplain', () => {
  beforeEach(() => {
    loadAiSettings.mockReset();
    getAiAvailability.mockReset();
    explainBreachImpactStructured.mockReset();
    vi.mocked(warmUpAi).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enabled=false when settings are off', async () => {
    loadAiSettings.mockReturnValue({ enableOnDeviceAI: false, allowBreachImpactAnalysis: false });
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiBreachImpactExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(false); });
  });

  it('enabled=true when settings on and available', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiBreachImpactExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    expect(warmUpAi).toHaveBeenCalled();
  });

  it('analyze sets a typed insight on success', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainBreachImpactStructured.mockResolvedValue({
      insight: { riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate'] },
    });
    const { result } = renderHook(() => useAiBreachImpactExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.analyze(input);
    });
    expect(result.current.insight).toEqual({ riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate'] });
    expect(result.current.rawText).toBeNull();
    expect(result.current.error).toBe(false);
  });

  it('analyze sets rawText when structured validation falls back', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainBreachImpactStructured.mockResolvedValue({ raw: 'Risk summary prose.' });
    const { result } = renderHook(() => useAiBreachImpactExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.analyze(input);
    });
    expect(result.current.rawText).toBe('Risk summary prose.');
    expect(result.current.insight).toBeNull();
  });

  it('analyze degrades to error=true, insight=null on failure', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainBreachImpactStructured.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAiBreachImpactExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.analyze(input);
    });
    expect(result.current.insight).toBeNull();
    expect(result.current.rawText).toBeNull();
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
