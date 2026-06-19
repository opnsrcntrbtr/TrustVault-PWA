import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const loadAiSettings = vi.fn();
const getAiAvailability = vi.fn();
const explainStrength = vi.fn();

vi.mock('@/core/ai/aiSettings', () => ({ loadAiSettings: () => loadAiSettings() }));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: () => getAiAvailability(),
  isFeatureUsable: (a: string) => a === 'available',
}));
vi.mock('@/core/ai/strengthExplain', () => ({
  explainStrength: (...a: unknown[]) => explainStrength(...a),
}));

import { useAiStrengthExplain } from '@/presentation/hooks/useAiStrengthExplain';

function bothOn() {
  loadAiSettings.mockReturnValue({ enableOnDeviceAI: true, allowStrengthExplanation: true });
}

describe('useAiStrengthExplain', () => {
  beforeEach(() => {
    loadAiSettings.mockReset();
    getAiAvailability.mockReset();
    explainStrength.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('enabled=false when settings are off', async () => {
    loadAiSettings.mockReturnValue({ enableOnDeviceAI: false, allowStrengthExplanation: false });
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(false));
  });

  it('enabled=false when availability not usable even if settings on', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('downloadable');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(getAiAvailability).toHaveBeenCalled());
    expect(result.current.enabled).toBe(false);
  });

  it('enabled=true when settings on and available', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it('explain sets explanation on success', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrength.mockResolvedValue('Strong because long.');
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.explain({ strength: 'strong', entropyBits: 80 });
    });
    expect(result.current.explanation).toBe('Strong because long.');
    expect(result.current.error).toBe(false);
  });

  it('explain degrades to error=true, explanation=null on failure', async () => {
    bothOn();
    getAiAvailability.mockResolvedValue('available');
    explainStrength.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAiStrengthExplain());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.explain({ strength: 'weak', entropyBits: 10 });
    });
    expect(result.current.explanation).toBeNull();
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
