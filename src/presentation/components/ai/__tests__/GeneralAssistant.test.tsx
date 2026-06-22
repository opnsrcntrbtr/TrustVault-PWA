import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/presentation/hooks/useAiChat', () => ({
  useAiChat: () => ({
    enabled: true, messages: [], streaming: false, error: false,
    send: vi.fn(), stop: vi.fn(), retry: vi.fn(), reset: vi.fn(),
  }),
}));

import { GeneralAssistant } from '@/presentation/components/ai/GeneralAssistant';

describe('GeneralAssistant', () => {
  it('renders the scope selector and chat input when open', () => {
    render(<GeneralAssistant open onClose={vi.fn()} />);
    expect(screen.getByLabelText(/scope/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask a follow-up/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<GeneralAssistant open={false} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/ask a follow-up/i)).not.toBeInTheDocument();
  });
});
