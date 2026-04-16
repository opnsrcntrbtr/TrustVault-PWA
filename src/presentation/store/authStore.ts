/**
 * Authentication Store (Zustand)
 * Manages authentication state and session
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthSession } from '@/domain/entities/User';

interface AuthState {
  // State
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  vaultKey: CryptoKey | null;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  setVaultKey: (key: CryptoKey | null) => void;
  lockVault: () => void;
  unlockVault: (key: CryptoKey) => void;
  lock: () => void; // Auto-lock method (clears vault key, keeps user)
  logout: () => void;
  clearSession: () => void; // Alias for logout (used in tests)
  signout: () => void; // Alias for logout (used in SettingsPage)
  updateUser: (user: User) => void; // Update user in store
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      session: null,
      isAuthenticated: false,
      isLocked: false,
      vaultKey: null,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setSession: (session) => set({ 
        session, 
        isLocked: session?.isLocked ?? false 
      }),
      
      setVaultKey: (key) => set({ vaultKey: key }),
      
      lockVault: () => set((state) => ({ 
        isLocked: true, 
        vaultKey: null,
        session: state.session ? { ...state.session, isLocked: true } : null
      })),
      
      unlockVault: (key) => set((state) => ({
        isLocked: false,
        vaultKey: key,
        session: state.session ? { ...state.session, isLocked: false } : null
      })),

      lock: () => set((state) => ({
        isLocked: true,
        vaultKey: null,
        session: state.session ? { ...state.session, isLocked: true } : null,
        // Keep user and isAuthenticated to allow re-unlock
      })),

      logout: () => set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLocked: false,
        vaultKey: null
      }),

      // Aliases for logout
      clearSession: () => set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLocked: false,
        vaultKey: null
      }),

      signout: () => set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLocked: false,
        vaultKey: null
      }),

      updateUser: (user) => set({ user, isAuthenticated: true }),
    }),
    {
      name: 'trustvault-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't persist sensitive data like vaultKey or session
      }),
    }
  )
);
