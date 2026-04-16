/**
 * useAutoLock Hook Tests
 * Tests auto-lock functionality with fake timers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoLock } from '@/presentation/hooks/useAutoLock';
import { useAuthStore } from '@/presentation/store/authStore';
import { useCredentialStore } from '@/presentation/store/credentialStore';
import { BrowserRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useAutoLock Hook', () => {
  beforeEach(() => {
    // Clear all stores
    useAuthStore.getState().clearSession();
    useCredentialStore.getState().clearCredentials();

    // Clear mocks
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Use fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  describe('Auto-lock on inactivity', () => {
    it('should lock after timeout period with no activity', async () => {
      // Setup authenticated state
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      // Render hook with 1 minute timeout
      renderHook(
        () => useAutoLock({
          timeoutMinutes: 1,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Verify not locked initially
      expect(useAuthStore.getState().isLocked).toBe(false);

      // Fast-forward time by 1 minute and wait for state updates
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
        await vi.runAllTimersAsync();
      });

      // Verify vault is locked
      expect(useAuthStore.getState().isLocked).toBe(true);

      // Verify vault key cleared
      expect(useAuthStore.getState().vaultKey).toBeNull();

      // Verify navigation to signin with locked state
      expect(mockNavigate).toHaveBeenCalledWith('/signin', {
        state: { locked: true, message: 'Session locked due to inactivity' }
      });
    });

    it('should reset timer on user activity', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 1,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Fast-forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Simulate user activity
      act(() => {
        document.dispatchEvent(new Event('mousedown'));
      });

      // Fast-forward another 30 seconds (total 60s)
      act(() => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Should NOT be locked (timer was reset at 30s)
      expect(useAuthStore.getState().isLocked).toBe(false);

      // Fast-forward another 30 seconds (total 90s, 60s since reset)
      await act(async () => {
        vi.advanceTimersByTime(30 * 1000);
        await vi.runAllTimersAsync();
      });

      // NOW should be locked
      expect(useAuthStore.getState().isLocked).toBe(true);
    });

    it('should not lock when timeout is 0 (never)', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 0, // Never lock
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Fast-forward a very long time
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      });

      // Should NOT be locked
      expect(useAuthStore.getState().isLocked).toBe(false);
    });
  });

  describe('Lock on tab visibility change', () => {
    it('should lock immediately when tab becomes hidden if lockOnTabHidden is true', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 15,
          lockOnTabHidden: true,
        }),
        { wrapper: BrowserRouter }
      );

      // Verify not locked initially
      expect(useAuthStore.getState().isLocked).toBe(false);

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden',
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runAllTimersAsync();
      });

      // Should lock immediately
      expect(useAuthStore.getState().isLocked).toBe(true);
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should not lock on tab hide if lockOnTabHidden is false', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 15,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should NOT lock
      expect(useAuthStore.getState().isLocked).toBe(false);
    });

    it('should reset timer when tab becomes visible again', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 1,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Fast-forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Simulate tab becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible',
      });

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Fast-forward another 30 seconds (total 60s from initial, but timer reset)
      act(() => {
        vi.advanceTimersByTime(30 * 1000);
      });

      // Should NOT be locked (timer was reset when becoming visible)
      expect(useAuthStore.getState().isLocked).toBe(false);
    });
  });

  describe('Credential clearing on lock', () => {
    it('should clear credentials from store when locking', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);

        // Add some credentials to store
        useCredentialStore.getState().setCredentials([
          {
            id: '1',
            title: 'Test Cred',
            username: 'user',
            password: 'pass',
            url: null,
            notes: null,
            category: 'login',
            isFavorite: false,
            tags: [],
            totpSecret: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
      });

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 1,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Verify credentials present
      expect(useCredentialStore.getState().credentials.length).toBe(1);

      // Fast-forward to trigger lock
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
        await vi.runAllTimersAsync();
      });

      // Verify locked
      expect(useAuthStore.getState().isLocked).toBe(true);

      // Credentials should be cleared
      expect(useCredentialStore.getState().credentials.length).toBe(0);
    });
  });

  describe('Manual lock', () => {
    it('should support manual lock via performLock method', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      const { result } = renderHook(
        () => useAutoLock({
          timeoutMinutes: 15,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      expect(useAuthStore.getState().isLocked).toBe(false);

      // Manually trigger lock
      await act(async () => {
        result.current.performLock();
        await vi.runAllTimersAsync();
      });

      // Should be locked
      expect(useAuthStore.getState().isLocked).toBe(true);
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should call onLock callback when locking', async () => {
      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const onLockCallback = vi.fn();

      act(() => {
        useAuthStore.getState().setUser({
          id: 'test-id',
          email: 'test@example.com',
          hashedMasterPassword: 'hashed',
          encryptedVaultKey: 'encrypted',
          salt: 'salt',
          biometricEnabled: false,
          webAuthnCredentials: [],
          createdAt: new Date(),
          lastLoginAt: new Date(),
          securitySettings: {
            sessionTimeoutMinutes: 15,
            requireBiometric: false,
            clipboardClearSeconds: 30,
            showPasswordStrength: true,
            enableSecurityAudit: true,
            passwordGenerationLength: 20,
            twoFactorEnabled: false,
          },
        });
        useAuthStore.getState().setVaultKey(mockVaultKey);
      });

      const { result } = renderHook(
        () => useAutoLock({
          timeoutMinutes: 15,
          lockOnTabHidden: false,
          onLock: onLockCallback,
        }),
        { wrapper: BrowserRouter }
      );

      // Trigger lock
      await act(async () => {
        result.current.performLock();
        await vi.runAllTimersAsync();
      });

      expect(onLockCallback).toHaveBeenCalled();
    });
  });

  describe('Not authenticated state', () => {
    it('should not set up timers when not authenticated', () => {
      // Don't set user or vault key
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      renderHook(
        () => useAutoLock({
          timeoutMinutes: 1,
          lockOnTabHidden: false,
        }),
        { wrapper: BrowserRouter }
      );

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(60 * 1000);
      });

      // Should NOT navigate or lock (nothing to lock)
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
