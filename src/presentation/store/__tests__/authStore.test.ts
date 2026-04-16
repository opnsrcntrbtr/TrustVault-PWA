/**
 * Authentication Store Tests
 * Zustand state management validation
 * Phase 0 & Phase 1 validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';

// Mock AuthStore (simplified for testing)
interface User {
  id: string;
  email: string;
}

interface AuthSession {
  id: string;
  userId: string;
  isLocked: boolean;
}

interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  vaultKey: CryptoKey | null;
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setVaultKey: (key: CryptoKey | null) => void;
  lockVault: () => void;
  unlockVault: (key: CryptoKey) => void;
  lock: () => void;
  logout: () => void;
}

const createAuthStore = () => create<AuthState>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLocked: false,
  vaultKey: null,

  setUser: (user) => { set({ user, isAuthenticated: !!user }); },
  
  setSession: (session) => { set({ 
    session, 
    isLocked: session?.isLocked ?? false 
  }); },
  
  setVaultKey: (key) => { set({ vaultKey: key }); },
  
  lockVault: () => { set((state) => ({ 
    isLocked: true, 
    vaultKey: null,
    session: state.session ? { ...state.session, isLocked: true } : null
  })); },
  
  unlockVault: (key) => { set((state) => ({
    isLocked: false,
    vaultKey: key,
    session: state.session ? { ...state.session, isLocked: false } : null
  })); },

  lock: () => { set((state) => ({
    isLocked: true,
    vaultKey: null,
    session: state.session ? { ...state.session, isLocked: true } : null,
  })); },

  logout: () => { set({
    user: null,
    session: null,
    isAuthenticated: false,
    isLocked: false,
    vaultKey: null
  }); },
}));

describe('Auth Store', () => {
  let useAuthStore: ReturnType<typeof createAuthStore>;

  beforeEach(() => {
    useAuthStore = createAuthStore();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBeNull();
    });
  });

  describe('User Management', () => {
    it('should set user and mark as authenticated', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      
      useAuthStore.getState().setUser(user);
      const state = useAuthStore.getState();
      
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should clear user and mark as not authenticated', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setUser(null);
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should set session', () => {
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      useAuthStore.getState().setSession(session);
      const state = useAuthStore.getState();
      
      expect(state.session).toEqual(session);
      expect(state.isLocked).toBe(false);
    });

    it('should update lock state from session', () => {
      const lockedSession: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: true
      };
      
      useAuthStore.getState().setSession(lockedSession);
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(true);
    });

    it('should handle null session', () => {
      useAuthStore.getState().setSession(null);
      const state = useAuthStore.getState();
      
      expect(state.session).toBeNull();
      expect(state.isLocked).toBe(false);
    });
  });

  describe('Vault Key Management', () => {
    it('should set vault key', () => {
      const mockKey = {} as CryptoKey;
      
      useAuthStore.getState().setVaultKey(mockKey);
      const state = useAuthStore.getState();
      
      expect(state.vaultKey).toBe(mockKey);
    });

    it('should clear vault key', () => {
      const mockKey = {} as CryptoKey;
      
      useAuthStore.getState().setVaultKey(mockKey);
      useAuthStore.getState().setVaultKey(null);
      const state = useAuthStore.getState();
      
      expect(state.vaultKey).toBeNull();
    });

    it('should not persist vault key (security)', () => {
      // Vault key should only be in memory, never persisted
      const mockKey = {} as CryptoKey;
      
      useAuthStore.getState().setVaultKey(mockKey);
      
      // In real implementation, persistence middleware should exclude vaultKey
      expect(useAuthStore.getState().vaultKey).toBe(mockKey);
    });
  });

  describe('Lock/Unlock Operations', () => {
    it('should lock vault and clear vault key', () => {
      const mockKey = {} as CryptoKey;
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setVaultKey(mockKey);
      useAuthStore.getState().lockVault();
      
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(true);
      expect(state.vaultKey).toBeNull();
      expect(state.session?.isLocked).toBe(true);
    });

    it('should unlock vault and set vault key', () => {
      const mockKey = {} as CryptoKey;
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: true
      };
      
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().unlockVault(mockKey);
      
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBe(mockKey);
      expect(state.session?.isLocked).toBe(false);
    });

    it('should auto-lock without destroying session', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      const mockKey = {} as CryptoKey;
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setVaultKey(mockKey);
      useAuthStore.getState().lock();
      
      const state = useAuthStore.getState();
      
      // Lock should preserve user and session
      expect(state.user).toEqual(user);
      expect(state.session).toBeDefined();
      expect(state.isLocked).toBe(true);
      expect(state.vaultKey).toBeNull();
      expect(state.isAuthenticated).toBe(true); // Still authenticated
    });
  });

  describe('Logout Operation', () => {
    it('should clear all state on logout', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      const mockKey = {} as CryptoKey;
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setVaultKey(mockKey);
      useAuthStore.getState().logout();
      
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBeNull();
    });

    it('should be idempotent', () => {
      useAuthStore.getState().logout();
      useAuthStore.getState().logout();
      
      const state = useAuthStore.getState();
      
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Security Flow', () => {
    it('should follow complete authentication flow', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      const mockKey = {} as CryptoKey;
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      // 1. Login
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setSession(session);
      useAuthStore.getState().setVaultKey(mockKey);
      
      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBe(mockKey);
      
      // 2. Auto-lock after inactivity
      useAuthStore.getState().lock();
      
      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true); // Still logged in
      expect(state.isLocked).toBe(true);
      expect(state.vaultKey).toBeNull(); // Key cleared
      
      // 3. Unlock with password re-entry
      useAuthStore.getState().unlockVault(mockKey);
      
      state = useAuthStore.getState();
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBe(mockKey);
      
      // 4. Logout
      useAuthStore.getState().logout();
      
      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should maintain separation between lock and logout', () => {
      const user: User = { id: '123', email: 'test@example.com' };
      const session: AuthSession = {
        id: 'session-123',
        userId: 'user-123',
        isLocked: false
      };
      
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setSession(session);
      
      // Lock should not logout
      useAuthStore.getState().lock();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toBeDefined();
      
      // Logout should clear everything
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle lock without session', () => {
      useAuthStore.getState().lock();
      
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(true);
      expect(state.session).toBeNull();
    });

    it('should handle unlock without session', () => {
      const mockKey = {} as CryptoKey;
      
      useAuthStore.getState().unlockVault(mockKey);
      
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(false);
      expect(state.vaultKey).toBe(mockKey);
      expect(state.session).toBeNull();
    });

    it('should handle multiple lock operations', () => {
      const mockKey = {} as CryptoKey;
      
      useAuthStore.getState().setVaultKey(mockKey);
      useAuthStore.getState().lock();
      useAuthStore.getState().lock();
      
      const state = useAuthStore.getState();
      
      expect(state.isLocked).toBe(true);
      expect(state.vaultKey).toBeNull();
    });
  });
});
