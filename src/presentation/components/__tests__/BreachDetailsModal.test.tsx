import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BreachDetailsModal from '@/presentation/components/BreachDetailsModal';
import type { BreachData } from '@/core/breach/breachTypes';

const sendMock = vi.fn().mockResolvedValue(undefined);
const useAiChatMock = vi.fn();
vi.mock('@/presentation/hooks/useAiChat', () => ({
  useAiChat: (): unknown => useAiChatMock(),
}));

const analyzeMock = vi.fn().mockResolvedValue(undefined);
const useAiBreachImpactExplainMock = vi.fn();
vi.mock('@/presentation/hooks/useAiBreachImpactExplain', () => ({
  useAiBreachImpactExplain: (): unknown => useAiBreachImpactExplainMock(),
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
  analyzeMock.mockClear();
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
  useAiBreachImpactExplainMock.mockReturnValue({
    enabled: true,
    loading: false,
    insight: null,
    rawText: null,
    error: false,
    analyze: analyzeMock,
    reset: vi.fn(),
  });
  loadAiSettingsMock.mockReturnValue({
    enableOnDeviceAI: true,
    allowBreachImpactAnalysis: true,
    allowChatFollowUp: true,
  });
});

describe('BreachDetailsModal AI Impact Analysis', () => {
  it('expanding AI analysis triggers the structured insight analyze() call', async () => {
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
    await waitFor(() => { expect(analyzeMock).toHaveBeenCalled(); });
  });

  it('renders a typed BreachInsightCard once analysis resolves', async () => {
    useAiBreachImpactExplainMock.mockReturnValue({
      enabled: true,
      loading: false,
      insight: { riskLevel: 'high', exposedData: ['Emails'], steps: ['rotate password'] },
      rawText: null,
      error: false,
      analyze: analyzeMock,
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
    expect(await screen.findByText(/high/i)).toBeInTheDocument();
    expect(await screen.findByText(/rotate password/i)).toBeInTheDocument();
  });

  it('renders the follow-up chat input below the insight when chat is enabled', async () => {
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
  });

  it('does not render the AI section when breach insight is not enabled', () => {
    useAiBreachImpactExplainMock.mockReturnValue({
      enabled: false,
      loading: false,
      insight: null,
      rawText: null,
      error: false,
      analyze: analyzeMock,
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
    useAiBreachImpactExplainMock.mockReturnValue({
      enabled: true,
      loading: false,
      insight: null,
      rawText: 'Static breach analysis text',
      error: false,
      analyze: analyzeMock,
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

  it('shows a retry action when structured analysis errors', async () => {
    useAiBreachImpactExplainMock.mockReturnValue({
      enabled: true,
      loading: false,
      insight: null,
      rawText: null,
      error: true,
      analyze: analyzeMock,
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
    expect(await screen.findByText(/failed to generate ai analysis/i)).toBeInTheDocument();
  });
});
