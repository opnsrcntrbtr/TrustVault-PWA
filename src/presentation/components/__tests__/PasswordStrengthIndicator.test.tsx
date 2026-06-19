import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordStrengthIndicator from '@/presentation/components/PasswordStrengthIndicator';

const explainMock = vi.fn();
vi.mock('@/presentation/hooks/useAiStrengthExplain', () => ({
  useAiStrengthExplain: () => ({
    enabled: true,
    loading: false,
    explanation: null,
    error: false,
    explain: explainMock,
    reset: vi.fn(),
  }),
}));

describe('PasswordStrengthIndicator AI Explanation', () => {
  it('does not render AI button if allowAiExplanation is false or missing', () => {
    render(<PasswordStrengthIndicator password="Password123!" />);
    expect(screen.queryByText('Explain with AI')).not.toBeInTheDocument();
  });

  it('renders AI button and triggers explain when clicked', async () => {
    render(<PasswordStrengthIndicator password="Password123!" allowAiExplanation={true} />);
    const btn = screen.getByText('Explain with AI');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => expect(explainMock).toHaveBeenCalled());
  });
});
