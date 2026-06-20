import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { getAiAvailability } from '@/core/ai/aiAvailability';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';

const { DEFAULTS, saveAiSettings, ensureReadySpy, removeWebllmModelSpy } = vi.hoisted(() => ({
  DEFAULTS: {
    enableOnDeviceAI: true,
    allowStrengthExplanation: true,
    allowBreachImpactAnalysis: true,
    webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    mobileAiModelReady: false,
  },
  saveAiSettings: vi.fn(),
  ensureReadySpy: vi.fn().mockImplementation(
    (onProgress?: (p: { progress: number; text?: string }) => void) => {
      onProgress?.({ progress: 1, text: 'done' });
      return Promise.resolve();
    },
  ),
  removeWebllmModelSpy: vi.fn().mockResolvedValue(undefined),
}));

let current = { ...DEFAULTS };
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: () => current,
  saveAiSettings: (s: typeof current) => { current = s; saveAiSettings(s); },
  DEFAULT_AI_SETTINGS: DEFAULTS,
}));
vi.mock('@/core/ai/aiAvailability', () => ({
  getAiAvailability: vi.fn().mockResolvedValue('available'),
}));
vi.mock('@/core/ai/providers/registry', () => ({
  getActiveProvider: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/core/ai/providers/webllmProvider', () => ({
  webllmProvider: { id: 'webllm', getAvailability: vi.fn(), ensureReady: ensureReadySpy, warmUp: vi.fn(), runStreaming: vi.fn() },
  removeWebllmModel: removeWebllmModelSpy,
}));
vi.mock('@/core/ai/providers/capabilities', () => ({
  isMobileAiSurfaceEnabled: vi.fn().mockReturnValue(false),
}));

import AiAssistanceSettings from '@/presentation/components/AiAssistanceSettings';

describe('AiAssistanceSettings', () => {
  beforeEach(() => {
    current = {
      enableOnDeviceAI: true,
      allowStrengthExplanation: true,
      allowBreachImpactAnalysis: true,
      webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      mobileAiModelReady: false,
    };
    saveAiSettings.mockReset();
    ensureReadySpy.mockClear();
    removeWebllmModelSpy.mockClear();
    vi.mocked(getAiAvailability).mockResolvedValue('available');
    vi.mocked(getActiveProvider).mockResolvedValue(null);
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

  it('shows the model download block and triggers ensureReady on Android/webllm', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'webllm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const btn = await screen.findByRole('button', { name: /download model/i });
    fireEvent.click(btn);
    await waitFor(() => { expect(ensureReadySpy).toHaveBeenCalled(); });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ mobileAiModelReady: true }),
      );
    });
  });

  it('persists model selection when the picker changes', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'webllm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const select = await screen.findByLabelText(/on-device model/i);
    fireEvent.change(select, { target: { value: 'gemma-2-2b-it-q4f16_1-MLC' } });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ webLlmModelId: 'gemma-2-2b-it-q4f16_1-MLC' }),
      );
    });
  });

  it('shows the remove-model button and calls removeWebllmModel when the model is ready', async () => {
    current = { ...current, mobileAiModelReady: true };
    vi.mocked(getAiAvailability).mockResolvedValue('available');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'webllm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const btn = await screen.findByRole('button', { name: /remove model/i });
    fireEvent.click(btn);
    await waitFor(() => { expect(removeWebllmModelSpy).toHaveBeenCalled(); });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ mobileAiModelReady: false }),
      );
    });
  });

  it('hides the model download block when not on Android/webllm', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(false);
    render(<AiAssistanceSettings />);
    await screen.findByText(/AI Assistance/i);
    expect(screen.queryByRole('button', { name: /download model/i })).not.toBeInTheDocument();
  });
});
