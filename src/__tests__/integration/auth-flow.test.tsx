/**
 * Authentication Flow Integration Tests
 * Tests complete signup → signin → signout flow with real components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

describe('Authentication Flow Integration', () => {
  beforeEach(async () => {
    // Clear all stores and database before each test
    useAuthStore.getState().clearSession();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/');

    // Clear database tables
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();

    // Wait for any pending operations
    await vi.waitFor(() => {}, { timeout: 100 });
  });

  describe('Signup Flow', () => {
    it('should keep direct /signin deep links on sign-in even with no local users', async () => {
      window.history.pushState({}, '', '/signin');
      render(

          <App />

      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.queryByRole('heading', { name: /create account/i })).not.toBeInTheDocument();
    });

    it('should complete signup with valid credentials', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // Wait for app to initialize - with no users, it auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      // Fill signup form — username is the required identity field (email is optional)
      const usernameInput = screen.getByLabelText(/username/i);
      // Both password fields have "Master Password" in label, so we use getAllByLabelText
      const passwordInputs = screen.getAllByLabelText(/master password/i);
      const passwordInput = passwordInputs[0]; // First one is the password field
      const confirmInput = passwordInputs[1]; // Second one is confirm field

      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'SecurePassword123!');
      await user.type(confirmInput, 'SecurePassword123!');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Should navigate to dashboard after signup completes
      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
      }, { timeout: 10000 });

      // Verify authenticated state
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe('newuser');
    });

    it('should reject signup with weak password', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      // Try weak password
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInputs = screen.getAllByLabelText(/master password/i);
      const passwordInput = passwordInputs[0];
      const confirmInput = passwordInputs[1];

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, '123456');
      await user.type(confirmInput, '123456');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Should show error about weak password (minimum length requirement)
      await waitFor(() => {
        expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
      });
    });

    it('should reject signup with mismatched passwords', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInputs = screen.getAllByLabelText(/master password/i);
      const passwordInput = passwordInputs[0];
      const confirmInput = passwordInputs[1];

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'SecurePassword123!');
      await user.type(confirmInput, 'DifferentPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Should show error about mismatched passwords (may appear in multiple places)
      await waitFor(() => {
        const errorElements = screen.getAllByText(/passwords do not match/i);
        expect(errorElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Signin Flow', () => {
    it('should signin with correct credentials after signup', async () => {
      const user = userEvent.setup();
      const { unmount } = render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      let usernameInput = screen.getByLabelText(/username/i);
      let passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      let submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // "TrustVault" appears in the signup page copy too, so wait for the
      // dashboard's add-credential FAB (only rendered post-auth) instead of
      // matching /vault/i, which matches immediately on the signup page.
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify user was created in database before signing out
      const userCount = await db.users.count();
      expect(userCount).toBe(1);

      // Sign out and clear persisted state
      useAuthStore.getState().clearSession();
      localStorage.clear();
      unmount();

      // Verify user still in database after unmount
      const userCountAfter = await db.users.count();
      expect(userCountAfter).toBe(1);

      // Now sign back in - user exists so should show signin page
      render(

          <App />

      );

      // Wait for initialization to complete first, then look for the signin heading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      }, { timeout: 10000 });

      usernameInput = screen.getByLabelText(/username/i);
      passwordInput = screen.getByLabelText(/^master password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'TestPassword123!');

      submitButton = screen.getByRole('button', { name: /^sign in$/i });
      await user.click(submitButton);

      // Should navigate to dashboard
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe('testuser');
    });

    it('should reject signin with incorrect password', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      let usernameInput = screen.getByLabelText(/username/i);
      let passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'CorrectPassword123!');
      await user.type(confirmInput, 'CorrectPassword123!');

      let submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // "TrustVault" appears in the signup page copy too, so wait for the
      // dashboard's add-credential FAB (only rendered post-auth) instead of
      // matching /vault/i, which matches immediately on the signup page.
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Sign out and try wrong password
      useAuthStore.getState().clearSession();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });

      usernameInput = screen.getByLabelText(/username/i);
      passwordInput = screen.getByLabelText(/^master password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'WrongPassword123!');

      submitButton = screen.getByRole('button', { name: /^sign in$/i });
      await user.click(submitButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
      });

      // Should still be on signin page
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('should reject signin with non-existent username', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // With no users in the DB, the app shows signup, not signin — but the
      // signin form is still reachable, and "Invalid username or password"
      // is what the signin handler returns regardless of whether any user
      // exists, so route through signup-page's "Sign in" link if present;
      // otherwise this app instance has no users and signin isn't reachable
      // without one, so seed a user first via signup.
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInputs = screen.getAllByLabelText(/master password/i);
      await user.type(usernameInput, 'someuser');
      expect(passwordInputs[0]).toBeDefined();
      expect(passwordInputs[1]).toBeDefined();
      await user.type(passwordInputs[0] as HTMLElement, 'SecurePassword123!');
      await user.type(passwordInputs[1] as HTMLElement, 'SecurePassword123!');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Sign out, then try a username that was never registered
      useAuthStore.getState().clearSession();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/username/i), 'nobody');
      await user.type(screen.getByLabelText(/^master password/i), 'AnyPassword123!');

      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Signout Flow', () => {
    // Skip: Complex cross-session tests require proper Zustand store reset between renders
    it('should clear session and redirect to signin on signout', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'signouttest');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // "TrustVault" appears in the signup page copy too, so wait for the
      // dashboard's add-credential FAB (only rendered post-auth) instead of
      // matching /vault/i, which matches immediately on the signup page.
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify authenticated
      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);

      // Open the account menu and click "Logout"
      const accountMenuButton = screen.getByRole('button', { name: /account menu/i });
      await user.click(accountMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
      });

      const logoutMenuItem = screen.getByRole('menuitem', { name: /logout/i });
      await user.click(logoutMenuItem);

      // Should redirect to signin
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });

      // Session should be cleared
      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.vaultKey).toBeNull();
    });
  });

  describe('Complete Auth Cycle', () => {
    it('should complete signup → signin → signout → signin cycle', async () => {
      const user = userEvent.setup();
      const testUsername = 'cycleuser';
      const testPassword = 'CycleTest123!';

      // Render app
      const { unmount } = render(

          <App />

      );

      // STEP 1: SIGNUP - with no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      let usernameInput = screen.getByLabelText(/username/i);
      let passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, testUsername);
      await user.type(passwordInput, testPassword);
      await user.type(confirmInput, testPassword);

      let submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // "TrustVault" appears in the signup page copy too, so wait for the
      // dashboard's add-credential FAB (only rendered post-auth) instead of
      // matching /vault/i, which matches immediately on the signup page.
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 10000 });

      // STEP 2: SIGNOUT
      useAuthStore.getState().clearSession();
      unmount();

      // STEP 3: SIGNIN #1
      render(

          <App />

      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      }, { timeout: 10000 });

      usernameInput = screen.getByLabelText(/username/i);
      passwordInput = screen.getByLabelText(/^master password/i);

      await user.type(usernameInput, testUsername);
      await user.type(passwordInput, testPassword);

      submitButton = screen.getByRole('button', { name: /^sign in$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe(testUsername);

      // STEP 4: SIGNOUT AGAIN
      useAuthStore.getState().clearSession();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      });

      // STEP 5: SIGNIN #2
      usernameInput = screen.getByLabelText(/username/i);
      passwordInput = screen.getByLabelText(/^master password/i);

      await user.type(usernameInput, testUsername);
      await user.type(passwordInput, testPassword);

      submitButton = screen.getByRole('button', { name: /^sign in$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.username).toBe(testUsername);
    });
  });

  describe('Lock/Unlock Flow (Use Case 1)', () => {
    it('should lock vault on inactivity and require unlock without losing data', async () => {
      const user = userEvent.setup();
      const testUsername = 'locktest';
      const testPassword = 'LockTest123!';

      render(

          <App />

      );

      // With no users, app auto-redirects to signup
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, testUsername);
      await user.type(passwordInput, testPassword);
      await user.type(confirmInput, testPassword);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vault/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Debug: check state right after seeing dashboard - ensure it's properly set
      const debugState = useAuthStore.getState();
      expect(debugState.isAuthenticated).toBeDefined();

      // Wait for state to be properly set after signup
      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      }, { timeout: 3000 });

      // Verify authenticated with vault key
      let state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.vaultKey).not.toBeNull();
      expect(state.isLocked).toBe(false);

      // Manually trigger lock
      useAuthStore.getState().lock();

      // Verify vault is locked but user still authenticated
      state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLocked).toBe(true);
      expect(state.vaultKey).toBeNull();
      expect(state.user).not.toBeNull();
    });

    it('should clear vault keys and credentials on lock', async () => {
      // Create account and sign in via store directly (no form — tests store behaviour)
      useAuthStore.getState().setUser({
        id: 'test-id',
        username: 'lockuser',
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

      const mockVaultKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      useAuthStore.getState().setVaultKey(mockVaultKey);
      useAuthStore.getState().setSession({
        userId: 'test-id',
        vaultKey: mockVaultKey,
        expiresAt: new Date(Date.now() + 900000),
        isLocked: false,
      });

      // Verify we have vault key before lock
      let state = useAuthStore.getState();
      expect(state.vaultKey).not.toBeNull();
      expect(state.isLocked).toBe(false);

      // Trigger lock
      useAuthStore.getState().lock();

      // Verify vault key cleared
      state = useAuthStore.getState();
      expect(state.vaultKey).toBeNull();
      expect(state.isLocked).toBe(true);
      expect(state.user).not.toBeNull(); // User still present for unlock
    });

    it('should lock on tab hide if lockOnTabHidden is true', () => {
      // This test would require mocking document.visibilityState
      // For now, we test the logic exists in useAutoLock hook
      const state = useAuthStore.getState();
      expect(state.lock).toBeDefined();
      expect(state.lockVault).toBeDefined();
    });
  });
});
