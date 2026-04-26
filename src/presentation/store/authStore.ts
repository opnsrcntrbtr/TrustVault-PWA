/**
 * Authentication Store (Zustand)
 * Manages authentication state and session
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, PublicUser, User } from '@/domain/entities/User';
import { toPublicUser } from '@/domain/entities/User';

interface AuthState {
  // State
  user: PublicUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  vaultKey: CryptoKey | null;

  // Actions
  setUser: (user: User | PublicUser | null) => void;
  setSession: (session: AuthSession | null) => void;
  setVaultKey: (key: CryptoKey | null) => void;
  lockVault: () => void;
  unlockVault: (key: CryptoKey) => void;
  lock: () => void; // Auto-lock method (clears vault key, keeps user)
  logout: () => void;
  clearSession: () => void; // Alias for logout (used in tests)
  signout: () => void; // Alias for logout (used in SettingsPage)
  updateUser: (user: User | PublicUser) => void; // Update public user in store
}

function isFullUser(user: User | PublicUser): user is User {
  return 'hashedMasterPassword' in user || 'encryptedVaultKey' in user || 'webAuthnCredentials' in user;
}

function sanitizeUser(user: User | PublicUser | null): PublicUser | null {
  if (!user) {
    return null;
  }

  if (isFullUser(user)) {
    return toPublicUser(user);
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    biometricEnabled: user.biometricEnabled,
    webAuthnCredentialCount: user.webAuthnCredentialCount,
    createdAt: user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt),
    lastLoginAt: user.lastLoginAt instanceof Date ? user.lastLoginAt : new Date(user.lastLoginAt),
    securitySettings: user.securitySettings,
  };
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
      setUser: (user) => set({ user: sanitizeUser(user), isAuthenticated: !!user }),
      
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

      updateUser: (user) => set({ user: sanitizeUser(user), isAuthenticated: true }),
    }),
    {
      name: 'trustvault-auth',
      version: 2,
      partialize: (state) => ({
        user: sanitizeUser(state.user),
        isAuthenticated: state.isAuthenticated,
        // Don't persist sensitive data like vaultKey or session
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthState> | undefined;
        return {
          user: sanitizeUser(state?.user ?? null),
          session: null,
          isAuthenticated: Boolean(state?.user),
          isLocked: Boolean(state?.user),
          vaultKey: null,
        } satisfies Partial<AuthState>;
      },
    }
  )
);
