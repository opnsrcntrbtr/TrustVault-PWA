import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { warmUpAi } from '@/core/ai/promptApi';

const loadAiSettings = vi.fn();
const getAiAvailability = vi.fn();
const explainStrengthStructured = vi.fn();

vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: (): unknown => loadAiSettings(),
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: (): unknown => getAiAvailability(),
  isFeatureUsable: (a: string): boolean => a === 'available',
}));
vi.mock('@/core/ai/strengthExplain', () => ({
  explainStrengthStructured: (...a: unknown[]): unknown => explainStrengthStructured(...a),
  STRENGTH_SYSTEM_PROMPT: 'mock-system-prompt'
}));
vi.mock('@/core/ai/promptApi', () => ({
  warmUpAi: vi.fn(() => Promise.resolve())
}));

import { useAiStrengthExplain } from '@/presentation/hooks/useAiStrengthExplain';

function bothOn() {
  loadAiSettings.mockReturnValue({ enableOnDeviceAI: true, allowStrengthExplanation: true });
}

describe('useAiStrengthExplain', () => {
  beforeEach(() => {
    loadAiSettings.mockReset();
    getAiAvailability.mockReset();
    explainStrengthStructured.mockReset();
    vi.mocked(warmUpAi).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enabled=false when settings are off', async () => {
    loadAiSettings.mockReturnValue({ enableOnDeviceAI: false, allowStrengthExplanation: false });
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(false); });
  });

  it('enabled=false when availability not usable even if settings on', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('downloadable');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(getAiAvailability).toHaveBeenCalled(); });
    expect(result.current.enabled).toBe(false);
  });

  it('enabled=true when settings on and available', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    expect(warmUpAi).toHaveBeenCalled();
  });

  it('explain sets a typed insight on success', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrengthStructured.mockResolvedValue({
      insight: { severity: 'high', factors: ['short'], rankedActions: ['lengthen'] },
    });
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.explain({ strength: 'weak', entropyBits: 20 });
    });
    expect(result.current.insight).toEqual({ severity: 'high', factors: ['short'], rankedActions: ['lengthen'] });
    expect(result.current.rawText).toBeNull();
    expect(result.current.error).toBe(false);
  });

  it('explain sets rawText when structured validation falls back', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrengthStructured.mockResolvedValue({ raw: 'Strong because long.' });
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.explain({ strength: 'strong', entropyBits: 80 });
    });
    expect(result.current.rawText).toBe('Strong because long.');
    expect(result.current.insight).toBeNull();
  });

  it('explain degrades to error=true, insight=null on failure', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrengthStructured.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => { expect(result.current.enabled).toBe(true); });
    await act(async () => {
      await result.current.explain({ strength: 'weak', entropyBits: 10 });
    });
    expect(result.current.insight).toBeNull();
    expect(result.current.rawText).toBeNull();
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
