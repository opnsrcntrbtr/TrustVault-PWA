import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';

const base = { messages: [], streaming: false, error: false, onSend: vi.fn(), onStop: vi.fn(), onRetry: vi.fn() };

describe('ChatPanel', () => {
  it('renders the local-only disclaimer', () => {
    render(<ChatPanel {...base} />);
    expect(screen.getByText(/never leave it/i)).toBeInTheDocument();
  });

  it('renders transcript messages', () => {
    render(<ChatPanel {...base} messages={[
      { id: '1', role: 'user', content: 'hello' },
      { id: '2', role: 'assistant', content: 'hi there' },
    ]} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('hi there')).toBeInTheDocument();
  });

  it('calls onSend with input text and clears the field', () => {
    const onSend = vi.fn();
    render(<ChatPanel {...base} onSend={onSend} />);
    fireEvent.change(screen.getByPlaceholderText(/ask a follow-up/i), { target: { value: 'why?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith('why?');
  });

  it('shows Stop while streaming and calls onStop', () => {
    const onStop = vi.fn();
    render(<ChatPanel {...base} streaming onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows an error row with Retry', () => {
    const onRetry = vi.fn();
    render(<ChatPanel {...base} error onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('clicking a suggestion sends it', () => {
    const onSend = vi.fn();
    render(<ChatPanel {...base} onSend={onSend} suggestions={["What's a passkey?"]} />);
    fireEvent.click(screen.getByRole('button', { name: /what's a passkey\?/i }));
    expect(onSend).toHaveBeenCalledWith("What's a passkey?");
  });
});
