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

/** What survives a page reload — never any key/hash/wrap material. */
interface PersistedAuthShell {
  user: Pick<User, 'id' | 'username' | 'displayName'> | null;
  isAuthenticated: boolean;
}

const toShell = (user: User | null): PersistedAuthShell['user'] =>
  user
    ? {
        id: user.id,
        ...(user.username !== undefined ? { username: user.username } : {}),
        ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
      }
    : null;

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
      version: 1,
      partialize: (state): PersistedAuthShell => ({
        // Shell only: full User (hash, encrypted vault key, salt, WebAuthn
        // wrap material) stays in IndexedDB and is refetched by App on boot.
        user: toShell(state.user),
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persisted): PersistedAuthShell => {
        // v0 snapshots stored the full User — strip to the shell and let the
        // overwrite-on-save remove the old secret-bearing copy.
        const old = persisted as { user?: User | null; isAuthenticated?: boolean };
        return {
          user: toShell(old.user ?? null),
          isAuthenticated: old.isAuthenticated ?? false,
        };
      },
    }
  )
);
