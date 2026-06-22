import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordStrengthIndicator from '@/presentation/components/PasswordStrengthIndicator';

const sendMock = vi.fn().mockResolvedValue(undefined);
const useAiChatMock = vi.fn();
vi.mock('@/presentation/hooks/useAiChat', () => ({
  useAiChat: (): unknown => useAiChatMock(),
}));

const loadAiSettingsMock = vi.fn();
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: (): unknown => loadAiSettingsMock(),
}));

beforeEach(() => {
  sendMock.mockClear();
  useAiChatMock.mockReturnValue({
    enabled: true,
    messages: [],
    streaming: false,
    error: false,
    send: sendMock,
    stop: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
  });
  loadAiSettingsMock.mockReturnValue({
    enableOnDeviceAI: true,
    allowStrengthExplanation: true,
    allowChatFollowUp: true,
  });
});

describe('PasswordStrengthIndicator AI Explanation', () => {
  it('does not render AI button if allowAiExplanation is false or missing', () => {
    render(<PasswordStrengthIndicator password="Password123!" />);
    expect(screen.queryByText('Explain with AI')).not.toBeInTheDocument();
  });

  it('renders AI button and triggers chat.send when clicked', async () => {
    render(<PasswordStrengthIndicator password="Password123!" allowAiExplanation={true} />);
    const btn = screen.getByText('Explain with AI');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => { expect(sendMock).toHaveBeenCalled(); });
  });

  it('shows a follow-up chat input after the explanation when chat is enabled', async () => {
    render(<PasswordStrengthIndicator password="Password123!" allowAiExplanation={true} />);
    fireEvent.click(await screen.findByRole('button', { name: /explain with ai/i }));
    expect(await screen.findByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
  });

  it('falls back to a static paragraph (no input) when follow-up chat is disabled', async () => {
    loadAiSettingsMock.mockReturnValue({
      enableOnDeviceAI: true,
      allowStrengthExplanation: true,
      allowChatFollowUp: false,
    });
    useAiChatMock.mockReturnValue({
      enabled: true,
      messages: [{ id: '1', role: 'assistant', content: 'Static explanation text' }],
      streaming: false,
      error: false,
      send: sendMock,
      stop: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });
    render(<PasswordStrengthIndicator password="Password123!" allowAiExplanation={true} />);
    fireEvent.click(await screen.findByRole('button', { name: /explain with ai/i }));
    expect(await screen.findByText('Static explanation text')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask a follow-up/i)).not.toBeInTheDocument();
  });
});
