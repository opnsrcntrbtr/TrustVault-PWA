import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from '../ErrorBoundary';
import RouteErrorBoundary from '../RouteErrorBoundary';

/** Throws on render when `when` is true. */
function Boom({ when = true }: { when?: boolean }) {
  if (when) {
    throw new Error('boom');
  }
  return <div>child ok</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error; silence the noise and
    // let individual tests assert on it where relevant.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <div>child ok</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('child ok')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback with the caught error when a child throws', () => {
    render(
      <ErrorBoundary fallback={(error) => <div>fallback: {error.message}</div>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback: boom')).toBeInTheDocument();
  });

  it('reset() restores children once they stop throwing', () => {
    function Harness() {
      const [throwing, setThrowing] = useState(true);
      return (
        <>
          <button onClick={() => setThrowing(false)}>stop throwing</button>
          <ErrorBoundary
            fallback={(_error, reset) => (
              <button onClick={reset}>try again</button>
            )}
          >
            <Boom when={throwing} />
          </ErrorBoundary>
        </>
      );
    }

    render(<Harness />);

    // Initially the child throws -> fallback visible.
    expect(screen.getByText('try again')).toBeInTheDocument();

    // Stop the child from throwing, then reset the boundary.
    fireEvent.click(screen.getByText('stop throwing'));
    fireEvent.click(screen.getByText('try again'));

    expect(screen.getByText('child ok')).toBeInTheDocument();
    expect(screen.queryByText('try again')).not.toBeInTheDocument();
  });

  it('calls onError when a child throws', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary fallback={() => <div>fallback</div>} onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('boom');
  });

  it('logs the error to console.error (dev diagnostics)', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );

    const loggedOurLine = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes('[ErrorBoundary]'),
    );
    expect(loggedOurLine).toBe(true);
  });
});

function LocationDisplay() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders route content normally when nothing throws', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <RouteErrorBoundary>
          <div>page content</div>
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('isolates a page crash: shows the route fallback while the shell survives', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <div>app shell</div>
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    // Shell sibling still rendered.
    expect(screen.getByText('app shell')).toBeInTheDocument();
    // Route fallback with both recovery actions.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('"Go to dashboard" navigates to /dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <LocationDisplay />
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('auto-resets when the route changes (keyed by pathname)', () => {
    function PathAwareChild() {
      const { pathname } = useLocation();
      if (pathname === '/boom') {
        throw new Error('boom');
      }
      return <div>safe at {pathname}</div>;
    }
    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate('/safe')}>go safe</button>
          <RouteErrorBoundary>
            <PathAwareChild />
          </RouteErrorBoundary>
        </>
      );
    }

    render(
      <MemoryRouter initialEntries={['/boom']}>
        <Harness />
      </MemoryRouter>,
    );

    // At /boom the child throws -> fallback shown.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Navigating changes pathname -> boundary remounts -> error cleared.
    fireEvent.click(screen.getByText('go safe'));

    expect(screen.getByText('safe at /safe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});
