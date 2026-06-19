import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const saveAiSettings = vi.fn();
let current = { enableOnDeviceAI: true, allowStrengthExplanation: true };
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => current,
  saveAiSettings: (s: typeof current) => { current = s; saveAiSettings(s); },
  DEFAULT_AI_SETTINGS: { enableOnDeviceAI: true, allowStrengthExplanation: true },
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('unavailable'),
}));

import AiAssistanceSettings from '@/presentation/components/AiAssistanceSettings';

describe('AiAssistanceSettings', () => {
  beforeEach(() => {
    current = { enableOnDeviceAI: true, allowStrengthExplanation: true };
    saveAiSettings.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the experimental section heading', () => {
    render(<AiAssistanceSettings />);
    expect(screen.getByText(/AI Assistance/i)).toBeInTheDocument();
  });

  it('master toggle persists via saveAiSettings', async () => {
    render(<AiAssistanceSettings />);
    const master = screen.getByLabelText(/Enable on-device AI/i);
    fireEvent.click(master);
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ enableOnDeviceAI: false }),
      );
    });
  });
});
