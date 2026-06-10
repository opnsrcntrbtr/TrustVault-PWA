/**
 * useServiceWorkerUpdate Hook Tests (Phase 6.2 — PWA update flow)
 * Mocks the ServiceWorkerContainer/Registration so the waiting-worker
 * detection, dismiss persistence, and skipWaiting() install handshake can
 * be verified without a real service worker.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServiceWorkerUpdate } from '@/presentation/hooks/useServiceWorkerUpdate';

interface MockWorker {
  scriptURL: string;
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

function createMockWorker(scriptURL: string, version: string): MockWorker {
  return {
    scriptURL,
    state: 'installed',
    // Replies to GET_VERSION over the transferred MessagePort, mirroring
    // the production sw message contract.
    postMessage: vi.fn((message: unknown, transfer?: Transferable[]) => {
      const msg = message as { type?: string };
      const port = transfer?.[0] as MessagePort | undefined;
      if (msg.type === 'GET_VERSION' && port) {
        port.postMessage({ type: 'VERSION', version });
      }
    }),
    addEventListener: vi.fn(),
  };
}

interface MockRegistration {
  waiting: MockWorker | null;
  installing: MockWorker | null;
  update: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

function createMockRegistration(waiting: MockWorker | null): MockRegistration {
  return {
    waiting,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
  };
}

function installServiceWorkerMock(registration: MockRegistration | undefined): {
  getRegistration: ReturnType<typeof vi.fn>;
} {
  const container = {
    controller: null,
    getRegistration: vi.fn().mockResolvedValue(registration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    value: container,
    configurable: true,
    writable: true,
  });

  return container;
}

function removeServiceWorkerMock(): void {
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

describe('useServiceWorkerUpdate', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    removeServiceWorkerMock();
    vi.restoreAllMocks();
  });

  it('reports an error when service workers are unsupported', async () => {
    removeServiceWorkerMock();
    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.error).toBe('Service workers are not supported in this browser');
    expect(result.current.updateAvailable).toBe(false);
  });

  it('reports an error when no service worker is registered', async () => {
    installServiceWorkerMock(undefined);
    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.error).toBe('No service worker registered');
    expect(result.current.updateAvailable).toBe(false);
  });

  it('flags an available update when a waiting worker exists at mount', async () => {
    const waiting = createMockWorker('https://app.example/sw.js', '2.0.0');
    installServiceWorkerMock(createMockRegistration(waiting));

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });
    expect(result.current.availableVersion).toBe('2.0.0');
    expect(sessionStorage.getItem('sw-update-available')).toBe('true');
  });

  it('suppresses the notification when the same update was dismissed this session', async () => {
    const waiting = createMockWorker('https://app.example/sw.js', '2.0.0');
    sessionStorage.setItem('sw-update-dismissed', waiting.scriptURL);
    installServiceWorkerMock(createMockRegistration(waiting));

    const { result } = renderHook(() => useServiceWorkerUpdate());

    // Give the mount effect a chance to run; the flag must stay false.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('dismissUpdate persists the worker scriptURL and hides the update', async () => {
    const waiting = createMockWorker('https://app.example/sw.js', '2.0.0');
    installServiceWorkerMock(createMockRegistration(waiting));

    const { result } = renderHook(() => useServiceWorkerUpdate());
    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    act(() => {
      result.current.dismissUpdate();
    });

    expect(result.current.updateAvailable).toBe(false);
    expect(sessionStorage.getItem('sw-update-dismissed')).toBe(waiting.scriptURL);
    expect(sessionStorage.getItem('sw-update-available')).toBeNull();
  });

  it('installUpdate sends SKIP_WAITING to the waiting worker', async () => {
    const waiting = createMockWorker('https://app.example/sw.js', '2.0.0');
    installServiceWorkerMock(createMockRegistration(waiting));

    const { result } = renderHook(() => useServiceWorkerUpdate());
    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(result.current.updateInstalling).toBe(true);
    expect(sessionStorage.getItem('sw-update-completed')).toBe('true');
  });

  it('installUpdate errors when there is no waiting worker', async () => {
    installServiceWorkerMock(createMockRegistration(null));

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.error).toBe('No update available to install');
  });
});
