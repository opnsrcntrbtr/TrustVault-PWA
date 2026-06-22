import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { getAiAvailability } from '@/core/ai/aiAvailability';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';

const { DEFAULTS, saveAiSettings, webllmEnsureReadySpy, removeWebllmModelSpy, litertEnsureReadySpy, removeLitertModelSpy } = vi.hoisted(() => ({
  DEFAULTS: {
    enableOnDeviceAI: true,
    allowStrengthExplanation: true,
    allowBreachImpactAnalysis: true,
    webLlmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    mobileAiModelReady: false,
    mobileInferenceEngine: 'litert-lm' as 'litert-lm' | 'webllm',
    litertModelId: 'gemma-3n-E2B-it',
    litertModelReady: false,
    allowChatFollowUp: true,
    enableGeneralAssistant: true,
    generalAssistantDefaultScope: 'stateless' as 'stateless' | 'curated' | 'per-credential',
  },
  saveAiSettings: vi.fn(),
  webllmEnsureReadySpy: vi.fn().mockImplementation(
    (onProgress?: (p: { progress: number; text?: string }) => void) => {
      onProgress?.({ progress: 1, text: 'done' });
      return Promise.resolve();
    },
  ),
  removeWebllmModelSpy: vi.fn().mockResolvedValue(undefined),
  litertEnsureReadySpy: vi.fn().mockImplementation(
    (onProgress?: (p: { progress: number; text?: string }) => void) => {
      onProgress?.({ progress: 1, text: 'done' });
      return Promise.resolve();
    },
  ),
  removeLitertModelSpy: vi.fn().mockResolvedValue(undefined),
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
  webllmProvider: { id: 'webllm', getAvailability: vi.fn(), ensureReady: webllmEnsureReadySpy, warmUp: vi.fn(), runStreaming: vi.fn() },
  removeWebllmModel: removeWebllmModelSpy,
}));
vi.mock('@/core/ai/providers/litertProvider', () => ({
  litertProvider: { id: 'litert-lm', getAvailability: vi.fn(), ensureReady: litertEnsureReadySpy, warmUp: vi.fn(), runStreaming: vi.fn() },
  removeLitertModel: removeLitertModelSpy,
}));
vi.mock('@/core/ai/providers/capabilities', () => ({
  isMobileAiSurfaceEnabled: vi.fn().mockReturnValue(false),
  isLitertEnabled: vi.fn().mockReturnValue(true),
  isWebllmEnabled: vi.fn().mockReturnValue(false),
}));

import AiAssistanceSettings from '@/presentation/components/AiAssistanceSettings';

describe('AiAssistanceSettings', () => {
  beforeEach(() => {
    current = { ...DEFAULTS };
    saveAiSettings.mockReset();
    webllmEnsureReadySpy.mockClear();
    removeWebllmModelSpy.mockClear();
    litertEnsureReadySpy.mockClear();
    removeLitertModelSpy.mockClear();
    vi.mocked(getAiAvailability).mockResolvedValue('available');
    vi.mocked(getActiveProvider).mockResolvedValue(null);
    vi.mocked(isLitertEnabled).mockReturnValue(true);
    vi.mocked(isWebllmEnabled).mockReturnValue(false);
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

  it('shows the model download block and triggers litertProvider.ensureReady by default (litert-lm engine)', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'litert-lm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const btn = await screen.findByRole('button', { name: /download model/i });
    fireEvent.click(btn);
    await waitFor(() => { expect(litertEnsureReadySpy).toHaveBeenCalled(); });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ litertModelReady: true }),
      );
    });
  });

  it('persists LiteRT model selection when the picker changes', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'litert-lm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const select = await screen.findByLabelText(/on-device model/i);
    fireEvent.change(select, { target: { value: 'gemma-3n-E4B-it' } });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ litertModelId: 'gemma-3n-E4B-it' }),
      );
    });
  });

  it('shows the remove-model button and calls removeLitertModel when the LiteRT model is ready', async () => {
    current = { ...current, litertModelReady: true };
    vi.mocked(getAiAvailability).mockResolvedValue('available');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'litert-lm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const btn = await screen.findByRole('button', { name: /remove model/i });
    fireEvent.click(btn);
    await waitFor(() => { expect(removeLitertModelSpy).toHaveBeenCalled(); });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ litertModelReady: false }),
      );
    });
  });

  it('hides the model download block when not on Android/a mobile engine', async () => {
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(false);
    render(<AiAssistanceSettings />);
    await screen.findByText(/AI Assistance/i);
    expect(screen.queryByRole('button', { name: /download model/i })).not.toBeInTheDocument();
  });

  it('hides the engine picker when only one mobile engine is enabled (shipped state)', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'litert-lm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    await screen.findByRole('button', { name: /download model/i });
    expect(screen.queryByLabelText(/inference engine/i)).not.toBeInTheDocument();
  });

  it('shows the engine picker and switches to webllm controls when both engines are enabled', async () => {
    vi.mocked(isWebllmEnabled).mockReturnValue(true);
    vi.mocked(getAiAvailability).mockResolvedValue('downloadable');
    vi.mocked(getActiveProvider).mockResolvedValue({ id: 'litert-lm' } as never);
    vi.mocked(isMobileAiSurfaceEnabled).mockReturnValue(true);

    render(<AiAssistanceSettings />);
    const picker = await screen.findByLabelText(/inference engine/i);
    fireEvent.change(picker, { target: { value: 'webllm' } });
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ mobileInferenceEngine: 'webllm' }),
      );
    });
  });

  it('renders chat toggles and persists changes when AI is available', async () => {
    render(<AiAssistanceSettings />);
    const followUp = await screen.findByRole('checkbox', { name: /follow-up chat/i });
    expect(followUp).toBeChecked();
    fireEvent.click(followUp);
    await waitFor(() => {
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowChatFollowUp: false }),
      );
    });
  });

  it('disables chat toggles when AI is unavailable', async () => {
    vi.mocked(getAiAvailability).mockResolvedValue('unavailable');
    render(<AiAssistanceSettings />);
    const followUp = await screen.findByRole('checkbox', { name: /follow-up chat/i });
    await waitFor(() => { expect(followUp).toBeDisabled(); });
  });
});
