/**
 * Auto-Lock Hook
 * Implements automatic session locking based on inactivity and tab visibility
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/presentation/store/authStore';
import { useCredentialStore } from '@/presentation/store/credentialStore';

export interface AutoLockConfig {
  timeoutMinutes: number; // 0 = disabled/never
  lockOnTabHidden: boolean;
  onLock?: () => void;
}

/**
 * Hook to automatically lock the vault after inactivity
 * @param config Auto-lock configuration
 */
export function useAutoLock(config: AutoLockConfig) {
  const navigate = useNavigate();
  const { isAuthenticated, lock } = useAuthStore();
  const { clearCredentials } = useCredentialStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isLockedRef = useRef<boolean>(false);

  /**
   * Lock the vault and clear sensitive data
   */
  const performLock = useCallback(() => {
    if (isLockedRef.current) return; // Prevent double-locking

    console.log('[AutoLock] Locking vault due to inactivity');
    isLockedRef.current = true;

    // Clear vault key and credentials from memory
    lock();
    clearCredentials();

    // Call optional callback
    config.onLock?.();

    // Navigate to signin with locked state indicator
    navigate('/signin', {
      state: { locked: true, message: 'Session locked due to inactivity' }
    });
  }, [lock, clearCredentials, navigate, config]);

  /**
   * Reset the inactivity timer
   */
  const resetTimer = useCallback(() => {
    if (config.timeoutMinutes === 0) return; // Never lock
    if (!isAuthenticated) return; // Not authenticated, no need to track

    lastActivityRef.current = Date.now();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    const timeoutMs = config.timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      // Double-check elapsed time (in case system clock changed)
      if (elapsed >= timeoutMs) {
        performLock();
      }
    }, timeoutMs);
  }, [config.timeoutMinutes, isAuthenticated, performLock]);

  /**
   * Handle user activity events
   */
  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return;
    resetTimer();
  }, [isAuthenticated, resetTimer]);

  /**
   * Handle tab visibility changes
   */
  const handleVisibilityChange = useCallback(() => {
    if (!isAuthenticated) return;

    if (document.visibilityState === 'hidden') {
      if (config.lockOnTabHidden) {
        console.log('[AutoLock] Tab hidden, locking immediately');
        performLock();
      }
    } else if (document.visibilityState === 'visible') {
      // Tab became visible again, reset timer
      console.log('[AutoLock] Tab visible, resetting timer');
      isLockedRef.current = false; // Allow locking again
      resetTimer();
    }
  }, [isAuthenticated, config.lockOnTabHidden, performLock, resetTimer]);

  /**
   * Setup event listeners for activity detection
   */
  useEffect(() => {
    if (!isAuthenticated || config.timeoutMinutes === 0) {
      // Clean up if not authenticated or auto-lock disabled
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Reset locked state when authenticated
    isLockedRef.current = false;

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isAuthenticated, config.timeoutMinutes, config.lockOnTabHidden, handleActivity, handleVisibilityChange, resetTimer]);

  /**
   * Reset timer when config changes
   */
  useEffect(() => {
    if (isAuthenticated && config.timeoutMinutes > 0) {
      resetTimer();
    }
  }, [config.timeoutMinutes, isAuthenticated, resetTimer]);

  return {
    resetTimer,
    performLock,
  };
}

/**
 * Get default auto-lock configuration from user settings
 */
export function getDefaultAutoLockConfig(
  sessionTimeoutMinutes?: number
): AutoLockConfig {
  return {
    timeoutMinutes: sessionTimeoutMinutes ?? 15, // Default 15 minutes
    lockOnTabHidden: false, // Don't lock immediately on tab switch by default
  };
}
