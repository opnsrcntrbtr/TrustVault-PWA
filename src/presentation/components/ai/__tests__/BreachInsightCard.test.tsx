import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BreachInsightCard } from '@/presentation/components/ai/BreachInsightCard';

describe('BreachInsightCard', () => {
  it('renders riskLevel, exposed data and steps', () => {
    render(<BreachInsightCard insight={{ riskLevel: 'critical', exposedData: ['Emails'], steps: ['rotate password'] }} />);
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
    expect(screen.getByText(/rotate password/i)).toBeInTheDocument();
  });
});
