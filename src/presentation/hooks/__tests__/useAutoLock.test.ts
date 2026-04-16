/**
 * Auto-Lock Hook Tests
 * Phase 2.3 validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffect, useRef, useCallback } from 'react';

// Mock auto-lock hook
interface AutoLockConfig {
  enabled: boolean;
  timeoutMinutes: number;
  lockOnTabSwitch?: boolean;
}

const createUseAutoLock = (lockCallback: () => void) => {
  return (config: AutoLockConfig) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const resetTimer = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!config.enabled) return;

      timeoutRef.current = setTimeout(() => {
        lockCallback();
      }, config.timeoutMinutes * 60 * 1000);

      lastActivityRef.current = Date.now();
    }, [config.enabled, config.timeoutMinutes]);

    const handleActivity = useCallback(() => {
      resetTimer();
    }, [resetTimer]);

    const handleVisibilityChange = useCallback(() => {
      if (config.lockOnTabSwitch && document.hidden) {
        lockCallback();
      }
    }, [config.lockOnTabSwitch]);

    // Setup and cleanup with useEffect
    useEffect(() => {
      if (typeof document === 'undefined') return;

      document.addEventListener('mousemove', handleActivity);
      document.addEventListener('keypress', handleActivity);
      document.addEventListener('click', handleActivity);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      resetTimer();

      // Cleanup
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        document.removeEventListener('mousemove', handleActivity);
        document.removeEventListener('keypress', handleActivity);
        document.removeEventListener('click', handleActivity);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [handleActivity, handleVisibilityChange, resetTimer]);

    return {
      resetTimer,
      lastActivityTime: lastActivityRef.current,
    };
  };
};

describe('Auto-Lock Hook', () => {
  let lockCallback: ReturnType<typeof vi.fn>;
  let useAutoLock: ReturnType<typeof createUseAutoLock>;

  beforeEach(() => {
    vi.useFakeTimers();
    lockCallback = vi.fn();
    useAutoLock = createUseAutoLock(lockCallback);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should setup hook with config', () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 15 };
      
      const { result } = renderHook(() => useAutoLock(config));
      
      expect(result.current).toBeDefined();
    });

    it('should trigger lock after timeout', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 1000); // 1 minute
      });
      
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });

    it('should not trigger lock when disabled', async () => {
      const config: AutoLockConfig = { enabled: false, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });

    it('should respect different timeout values', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 5 };
      
      renderHook(() => useAutoLock(config));
      
      // Before timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
      });
      expect(lockCallback).not.toHaveBeenCalled();
      
      // After timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Activity Detection', () => {
    it('should reset timer on mouse move', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      // Wait 30 seconds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 1000);
      });
      
      // Trigger mouse move
      await act(async () => {
        document.dispatchEvent(new MouseEvent('mousemove'));
      });
      
      // Wait another 45 seconds (total 75s, but reset at 30s)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
      
      // Wait remaining 15 seconds (60s from last activity)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });
      
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on keypress', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 1000);
      });
      
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keypress'));
      });
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });

    it('should reset timer on click', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * 1000);
      });
      
      await act(async () => {
        document.dispatchEvent(new MouseEvent('click'));
      });
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid activities', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      renderHook(() => useAutoLock(config));
      
      // Simulate rapid user activity
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5 * 1000);
          document.dispatchEvent(new MouseEvent('mousemove'));
        });
      }
      
      expect(lockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Tab Visibility', () => {
    it('should lock when tab becomes hidden if configured', async () => {
      const config: AutoLockConfig = {
        enabled: true,
        timeoutMinutes: 15,
        lockOnTabSwitch: true
      };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          writable: true,
          configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });

    it('should not lock on tab switch if not configured', async () => {
      const config: AutoLockConfig = {
        enabled: true,
        timeoutMinutes: 15,
        lockOnTabSwitch: false
      };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          writable: true,
          configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });

    it('should not lock when tab becomes visible', async () => {
      const config: AutoLockConfig = {
        enabled: true,
        timeoutMinutes: 15,
        lockOnTabSwitch: true
      };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          writable: true,
          configurable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on unmount', async () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 1 };
      
      const { unmount } = renderHook(() => useAutoLock(config));
      
      unmount();
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const config: AutoLockConfig = { enabled: true, timeoutMinutes: 15 };
      
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = renderHook(() => useAutoLock(config));
      
      const addCallCount = addEventListenerSpy.mock.calls.length;
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(addCallCount);
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Security Considerations', () => {
    it('should lock after configured time regardless of tab state', async () => {
      const config: AutoLockConfig = {
        enabled: true,
        timeoutMinutes: 1,
        lockOnTabSwitch: false
      };
      
      renderHook(() => useAutoLock(config));
      
      // Even with tab visible, should lock after timeout
      await act(async () => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          writable: true,
          configurable: true
        });
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
      
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });

    it('should support very short timeouts for high security', async () => {
      const config: AutoLockConfig = {
        enabled: true,
        timeoutMinutes: 0.25 // 15 seconds
      };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });
      
      expect(lockCallback).toHaveBeenCalledTimes(1);
    });

    it('should support disabling auto-lock for convenience', async () => {
      const config: AutoLockConfig = {
        enabled: false,
        timeoutMinutes: 1
      };
      
      renderHook(() => useAutoLock(config));
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 1000);
      });
      
      expect(lockCallback).not.toHaveBeenCalled();
    });
  });
});
