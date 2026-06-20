import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { getAiAvailability } from '@/core/ai/aiAvailability';

const saveAiSettings = vi.fn();
let current = { enableOnDeviceAI: true, allowStrengthExplanation: true, allowBreachImpactAnalysis: true };
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => current,
  saveAiSettings: (s: typeof current) => { current = s; saveAiSettings(s); },
  DEFAULT_AI_SETTINGS: { enableOnDeviceAI: true, allowStrengthExplanation: true, allowBreachImpactAnalysis: true },
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('available'),
}));

import AiAssistanceSettings from '@/presentation/components/AiAssistanceSettings';

describe('AiAssistanceSettings', () => {
  beforeEach(() => {
    current = { enableOnDeviceAI: true, allowStrengthExplanation: true, allowBreachImpactAnalysis: true };
    saveAiSettings.mockReset();
    vi.mocked(getAiAvailability).mockResolvedValue('available');
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the experimental section heading', () => {
    render(<AiAssistanceSettings />);
    expect(screen.getByText(/AI Assistance/i)).toBeInTheDocument();
  });

  it('master toggle persists via saveAiSettings when AI is available', async () => {
    render(<AiAssistanceSettings />);
    const master = await screen.findByLabelText(/Enable on-device AI/i);
    await waitFor(() => { expect(master).not.toBeDisabled(); });
    fireEvent.click(master);
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enableOnDeviceAI: false }),
      );
    });
  });

  it('disables the master toggle (and sub-toggles) when on-device AI is unavailable on this platform', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('unavailable');
    render(<AiAssistanceSettings />);

    const master = await screen.findByLabelText(/Enable on-device AI/i);
    await waitFor(() => { expect(master).toBeDisabled(); });

    expect(screen.getByLabelText(/Allow AI to explain password strength/i)).toBeDisabled();
    expect(screen.getByLabelText(/Allow AI to explain breach impact/i)).toBeDisabled();
  });
});
