import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StrengthInsightCard } from '@/presentation/components/ai/StrengthInsightCard';

describe('StrengthInsightCard', () => {
  it('renders severity, factors and ranked actions', () => {
    render(<StrengthInsightCard insight={{ severity: 'high', factors: ['too short'], rankedActions: ['use 16+ chars'] }} />);
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    expect(screen.getByText(/too short/)).toBeInTheDocument();
    expect(screen.getByText(/use 16\+ chars/i)).toBeInTheDocument();
  });
});
