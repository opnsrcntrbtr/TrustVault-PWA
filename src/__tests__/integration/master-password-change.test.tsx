/**
 * Master Password Change Integration Tests
 * Tests complete flow of changing master password with credential re-encryption
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

// Helper to setup authenticated user with credentials
async function setupAuthenticatedUserWithCredentials(user: ReturnType<typeof userEvent.setup>) {
  // With no users in DB, app redirects directly to signup
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  const emailInput = screen.getByLabelText(/email/i);
  // Both password fields have "Master Password" in label, so we use getAllByLabelText
  const passwordInputs = screen.getAllByLabelText(/master password/i);
  const passwordInput = passwordInputs[0]; // First one is the password field
  const confirmInput = passwordInputs[1]; // Second one is confirm field

  await user.type(emailInput, 'changetest@example.com');
  await user.type(passwordInput, 'OldPassword123!');
  await user.type(confirmInput, 'OldPassword123!');

  const submitButton = screen.getByRole('button', { name: /create account/i });
  await user.click(submitButton);

  await waitFor(() => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  }, { timeout: 10000 });

  // Add a test credential
  const addButton = screen.getByLabelText('add');
  await user.click(addButton);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
  });

  const titleInput = screen.getByLabelText(/title/i);
  const usernameInput = screen.getByLabelText(/username/i);
  const credPasswordInput = screen.getByLabelText(/^password/i);

  await user.type(titleInput, 'Test Account');
  await user.type(usernameInput, 'testuser@example.com');
  await user.type(credPasswordInput, 'TestCredential123!');

  const saveButton = screen.getByRole('button', { name: /save/i });
  await user.click(saveButton);

  await waitFor(() => {
    expect(screen.getByText('Test Account')).toBeInTheDocument();
  }, { timeout: 5000 });
}

describe('Master Password Change Integration', () => {
  beforeEach(async () => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
    sessionStorage.clear();
    // Clear database tables to ensure clean state
    await db.users.clear();
    await db.credentials.clear();
    await db.sessions.clear();
    await vi.waitFor(() => {}, { timeout: 100 });
  });

  describe('Change Master Password Flow', () => {
    it('should successfully change master password and re-encrypt credentials', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      // Find and click "Change Master Password" button
      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      // Verify dialog opened
      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      // Fill out the form
      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'NewPassword456!');

      // Click Change Password button
      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify re-encryption progress dialog appears
      await waitFor(() => {
        expect(screen.getByText(/re-encrypting/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Wait for re-encryption to complete and automatic signout
      await waitFor(() => {
        expect(screen.getByText(/sign in/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify success message
      expect(screen.getByText(/password.*changed.*successfully/i)).toBeInTheDocument();

      // Sign in with NEW password
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'changetest@example.com');
      await user.type(passwordInput, 'NewPassword456!');

      const signinButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(signinButton);

      // Verify successful signin
      await waitFor(() => {
        expect(screen.getByText(/vault/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify credential still accessible and decrypts correctly
      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // Click on credential to view details
      const credentialCard = screen.getByText('Test Account');
      await user.click(credentialCard);

      // Verify password field displays decrypted password
      await waitFor(() => {
        const passwordField = screen.getByDisplayValue('TestCredential123!');
        expect(passwordField).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should reject incorrect current password', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      // Enter WRONG current password
      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'WrongPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'NewPassword456!');

      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify error message
      await waitFor(() => {
        expect(screen.getByText(/incorrect.*current password|invalid password/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify dialog still open (not closed on error)
      expect(screen.getByText(/change master password/i)).toBeInTheDocument();
    });

    it('should validate new password strength', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'weak');
      await user.type(confirmNewPasswordInput, 'weak');

      // Verify strength indicator shows "weak"
      await waitFor(() => {
        expect(screen.getByText(/weak|too weak/i)).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/password.*too weak|minimum.*12 characters/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should require matching new password confirmation', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'DifferentPassword789!');

      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify mismatch error
      await waitFor(() => {
        expect(screen.getByText(/passwords.*do not match|passwords must match/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Re-encryption Progress', () => {
    it('should show progress indicator during re-encryption', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      const currentPasswordInput = screen.getByLabelText(/current password/i);
      const newPasswordInput = screen.getByLabelText(/^new password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'NewPassword456!');

      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify progress dialog appears
      await waitFor(() => {
        expect(screen.getByText(/re-encrypting.*credentials/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify progress indicator or count appears
      await waitFor(() => {
        expect(
          screen.getByText(/progress|re-encrypting 1 of 1|processing/i)
        ).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Warning Messages', () => {
    it('should show warning about re-encryption before proceeding', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      await user.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByText(/change master password/i)).toBeInTheDocument();
      });

      // Verify warning about re-encryption is displayed
      expect(
        screen.getByText(/will re-encrypt all credentials|this will re-encrypt/i)
      ).toBeInTheDocument();
    });
  });
});
