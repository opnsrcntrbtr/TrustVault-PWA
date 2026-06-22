import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BreachDetailsModal from '@/presentation/components/BreachDetailsModal';
import type { BreachData } from '@/core/breach/breachTypes';

const sendMock = vi.fn().mockResolvedValue(undefined);
const useAiChatMock = vi.fn();
vi.mock('@/presentation/hooks/useAiChat', () => ({
  useAiChat: (): unknown => useAiChatMock(),
}));

const loadAiSettingsMock = vi.fn();
vi.mock('@/core/ai/aiSettings', () => ({
  loadAiSettings: (): unknown => loadAiSettingsMock(),
}));

const breach: BreachData = {
  name: 'ExampleBreach',
  title: 'Example Breach',
  domain: 'example.com',
  breachDate: '2024-01-01',
  addedDate: '2024-01-02',
  modifiedDate: '2024-01-02',
  pwnCount: 1000,
  description: 'An example breach',
  dataClasses: ['Email addresses', 'Passwords'],
  isVerified: true,
  isFabricated: false,
  isSensitive: false,
  isRetired: false,
  isSpamList: false,
  logoPath: '',
};

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
    allowBreachImpactAnalysis: true,
    allowChatFollowUp: true,
  });
});

describe('BreachDetailsModal AI Impact Analysis', () => {
  it('renders a follow-up chat input after expanding AI analysis', async () => {
    render(
      <BreachDetailsModal
        open={true}
        onClose={vi.fn()}
        breaches={[breach]}
        credentialTitle="Example Account"
        severity="high"
      />,
    );
    fireEvent.click(await screen.findByText(/AI Impact Analysis/i));
    expect(await screen.findByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
    await waitFor(() => { expect(sendMock).toHaveBeenCalled(); });
  });

  it('does not render the AI section when chat is not enabled', () => {
    useAiChatMock.mockReturnValue({
      enabled: false,
      messages: [],
      streaming: false,
      error: false,
      send: sendMock,
      stop: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <BreachDetailsModal
        open={true}
        onClose={vi.fn()}
        breaches={[breach]}
        credentialTitle="Example Account"
        severity="high"
      />,
    );
    expect(screen.queryByText(/AI Impact Analysis/i)).not.toBeInTheDocument();
  });

  it('falls back to a static paragraph (no input) when follow-up chat is disabled', async () => {
    loadAiSettingsMock.mockReturnValue({
      enableOnDeviceAI: true,
      allowBreachImpactAnalysis: true,
      allowChatFollowUp: false,
    });
    useAiChatMock.mockReturnValue({
      enabled: true,
      messages: [{ id: '1', role: 'assistant', content: 'Static breach analysis text' }],
      streaming: false,
      error: false,
      send: sendMock,
      stop: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <BreachDetailsModal
        open={true}
        onClose={vi.fn()}
        breaches={[breach]}
        credentialTitle="Example Account"
        severity="high"
      />,
    );
    fireEvent.click(await screen.findByText(/AI Impact Analysis/i));
    expect(await screen.findByText('Static breach analysis text')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask a follow-up/i)).not.toBeInTheDocument();
  });
});
