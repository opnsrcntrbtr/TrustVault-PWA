/**
 * useDriverTour Tests
 * driver.js itself is mocked (DOM overlay behavior is out of scope for a
 * unit test); this exercises the hook's public surface and the
 * localStorage-backed completion state reachable only through it, since
 * the underlying getTourState/saveTourState/markTourCompleted helpers are
 * not exported.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDriverTour, isFirstTimeUser, isTourCompleted, resetTourState } from '@/hooks/useDriverTour';

vi.mock('driver.js', () => ({
  driver: vi.fn((config: { onDestroyStarted?: (el: unknown, step: unknown, opts: unknown) => void }) => ({
    drive: vi.fn(() => {
      // Simulate the user completing the tour immediately, which is what
      // triggers markTourCompleted() inside the real onDestroyStarted hook.
      config.onDestroyStarted?.(undefined, undefined, undefined);
    }),
    destroy: vi.fn(),
    isActive: vi.fn(() => false),
  })),
}));

describe('useDriverTour', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isFirstTimeUser() / isTourCompleted() — fresh state', () => {
    it('treats a user with no stored state as first-time', () => {
      expect(isFirstTimeUser()).toBe(true);
    });

    it('reports every tour as not completed before any tour runs', () => {
      expect(isTourCompleted('dashboard')).toBe(false);
      expect(isTourCompleted('security')).toBe(false);
    });
  });

  describe('resetTourState()', () => {
    it('clears persisted state so isFirstTimeUser() reverts to true', () => {
      localStorage.setItem(
        'trustvault_tour_state',
        JSON.stringify({ completed: true, version: '1.0.0', tours: { 'first-time': true } })
      );
      expect(isFirstTimeUser()).toBe(false);

      resetTourState();

      expect(isFirstTimeUser()).toBe(true);
    });
  });

  describe('useDriverTour() hook', () => {
    it('exposes a start function for every tour type and the state helpers', () => {
      const { result } = renderHook(() => useDriverTour());

      expect(typeof result.current.startFirstTimeTour).toBe('function');
      expect(typeof result.current.startDashboardTour).toBe('function');
      expect(typeof result.current.startSecurityTour).toBe('function');
      expect(typeof result.current.startCredentialsTour).toBe('function');
      expect(typeof result.current.startExportTour).toBe('function');
      expect(typeof result.current.startPWAInstallTour).toBe('function');
      expect(typeof result.current.startBiometricTour).toBe('function');
      expect(result.current.isFirstTimeUser).toBe(true);
    });

    it('marks the dashboard tour completed after starting and driving it', () => {
      const { result } = renderHook(() => useDriverTour());

      act(() => {
        result.current.startDashboardTour();
      });

      expect(result.current.isTourCompleted('dashboard')).toBe(true);
    });

    it('marks the overall tour completed when the first-time tour finishes', () => {
      const { result } = renderHook(() => useDriverTour());

      act(() => {
        result.current.startFirstTimeTour();
      });

      expect(isFirstTimeUser()).toBe(false);
    });

    it('starting one tour does not mark a different tour as completed', () => {
      const { result } = renderHook(() => useDriverTour());

      act(() => {
        result.current.startSecurityTour();
      });

      expect(result.current.isTourCompleted('credentials')).toBe(false);
    });
  });
});
