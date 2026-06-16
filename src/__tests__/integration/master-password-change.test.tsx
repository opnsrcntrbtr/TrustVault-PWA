/**
 * Master Password Change Integration Tests
 * Tests complete flow of changing master password with credential re-encryption
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import ReEncryptionProgress from '@/presentation/components/ReEncryptionProgress';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

// Helper to setup authenticated user with credentials
async function setupAuthenticatedUserWithCredentials(user: ReturnType<typeof userEvent.setup>) {
  // With no users in DB, app redirects directly to signup
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  const usernameInput = screen.getByLabelText(/username/i);
  const emailInput = screen.getByLabelText(/email/i);
  // Both password fields have "Master Password" in label, so we use getAllByLabelText
  const passwordInputs = screen.getAllByLabelText(/master password/i);
  const passwordInput = passwordInputs[0]; // First one is the password field
  const confirmInput = passwordInputs[1]; // Second one is confirm field

  await user.type(usernameInput, 'changetestuser');
  await user.type(emailInput, 'changetest@example.com');
  await user.type(passwordInput, 'OldPassword123!');
  await user.type(confirmInput, 'OldPassword123!');

  const submitButton = screen.getByRole('button', { name: /create account/i });
  await user.click(submitButton);

  await waitFor(() => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  }, { timeout: 10000 });

  // Wait for post-signup navigation to the dashboard to complete
  await waitFor(() => {
    expect(screen.getByLabelText('add')).toBeInTheDocument();
  }, { timeout: 5000 });

  // Add a test credential
  const addButton = screen.getByLabelText('add');
  await user.click(addButton);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
  });

  const titleInput = screen.getByLabelText(/title/i);
  const credUsernameInput = screen.getByLabelText(/username/i);
  const credPasswordInput = screen.getByLabelText(/^password/i);

  await user.type(titleInput, 'Test Account');
  await user.type(credUsernameInput, 'testuser@example.com');
  await user.type(credPasswordInput, 'TestCredential123!');

  const saveButton = screen.getByRole('button', { name: /save/i });
  await user.click(saveButton);

  await waitFor(() => {
    expect(screen.getByText('Test Account')).toBeInTheDocument();
  }, { timeout: 5000 });

  // Wait for the dashboard to fully settle after the save-triggered
  // navigation before any further interaction.
  await waitFor(() => {
    expect(screen.getByLabelText('add')).toBeInTheDocument();
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
    // BrowserRouter reads jsdom's shared window.history, which persists
    // across tests in this file.
    window.history.pushState({}, '', '/');
    // Prevent the driver.js onboarding tour from auto-launching: it clones
    // highlighted elements into a popover, creating duplicate text matches.
    localStorage.setItem('trustvault_tour_state', JSON.stringify({ completed: true, version: '1.0.0', tours: {} }));
  });

  describe('Change Master Password Flow', () => {
    it('should successfully change master password and re-encrypt credentials', async () => {
      const user = userEvent.setup();
      // Real 2s signout delay (ChangeMasterPasswordDialog) + scrypt
      // re-derivation on re-signin exceed the default 5000ms test timeout.
      render(

          <App />

      );

      await setupAuthenticatedUserWithCredentials(user);

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      // Find and click "Change Master Password" button
      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      fireEvent.click(changePasswordButton);

      // Verify dialog opened (MUI Dialog transition can take longer than the
      // default 1000ms waitFor timeout)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Fill out the form
      const currentPasswordInput = screen.getByLabelText(/current master password/i);
      const newPasswordInput = screen.getByLabelText(/^new master password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new master password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'NewPassword456!');

      // Click Change Password button
      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Re-encryption of a single credential plus scrypt key derivation
      // completes within a tick in the test environment, so the
      // "Re-encrypting Credentials" progress UI and the brief Settings
      // success message can both flash and disappear before they can be
      // observed — assert on the eventual outcome instead: automatic
      // signout back to the signin page. The change-password flow performs
      // several real scrypt derivations (N=131072) plus a 2s logout delay;
      // under CPU contention from parallel test workers this has been
      // observed to take well over 20s, so allow a generous timeout.
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      }, { timeout: 45000 });

      // Sign in with NEW password
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/^master password/i);

      await user.type(usernameInput, 'changetestuser');
      await user.type(passwordInput, 'NewPassword456!');

      const signinButton = screen.getByRole('button', { name: /^sign in$/i });
      await user.click(signinButton);

      // Verify successful signin
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify credential still accessible and decrypts correctly
      await waitFor(() => {
        expect(screen.getByText('Test Account')).toBeInTheDocument();
      });

      // Verify the credential decrypts correctly with the new vault key by
      // copying its password from the dashboard card and checking the
      // clipboard write - the password itself is always masked
      // ("••••••••") in the UI.
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
      const copyPasswordButton = screen.getByRole('button', { name: /^password$/i });
      await user.click(copyPasswordButton);

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith('TestCredential123!');
      }, { timeout: 3000 });
    }, 60000);

    it('should reject incorrect current password', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithCredentials(user);

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      fireEvent.click(changePasswordButton);

      // MUI Dialog transition can take longer than the default 1000ms
      // waitFor timeout.
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Enter WRONG current password
      const currentPasswordInput = screen.getByLabelText(/current master password/i);
      const newPasswordInput = screen.getByLabelText(/^new master password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new master password/i);

      await user.type(currentPasswordInput, 'WrongPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'NewPassword456!');

      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      await user.click(submitButton);

      // Verify error message - the dialog reports the verbatim error from
      // ChangeMasterPasswordDialog's verifyPassword check.
      await waitFor(() => {
        expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Verify dialog still open (not closed on error)
      expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
    }, 20000);

    it('should validate new password strength', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      fireEvent.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      const currentPasswordInput = screen.getByLabelText(/current master password/i);
      const newPasswordInput = screen.getByLabelText(/^new master password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new master password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'weak');
      await user.type(confirmNewPasswordInput, 'weak');

      // Verify strength indicator shows the password is weak
      await waitFor(() => {
        expect(screen.getByText(/^(very )?weak$/i)).toBeInTheDocument();
      });

      // A new password under 12 characters is below the minimum, so the
      // "Minimum 12 characters" helper text remains visible and the submit
      // button stays disabled - the dialog never calls handleSubmit.
      expect(screen.getByText(/minimum 12 characters/i)).toBeInTheDocument();
      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      expect(submitButton).toBeDisabled();
    });

    it('should require matching new password confirmation', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      fireEvent.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      const currentPasswordInput = screen.getByLabelText(/current master password/i);
      const newPasswordInput = screen.getByLabelText(/^new master password/i);
      const confirmNewPasswordInput = screen.getByLabelText(/confirm new master password/i);

      await user.type(currentPasswordInput, 'OldPassword123!');
      await user.type(newPasswordInput, 'NewPassword456!');
      await user.type(confirmNewPasswordInput, 'DifferentPassword789!');

      // Verify mismatch helper text is shown on the confirm field, and the
      // submit button is disabled - the dialog never calls handleSubmit.
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
      const submitButton = screen.getByRole('button', { name: /^change password$/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Re-encryption Progress', () => {
    // The full change-password flow re-encrypts a single credential and
    // signs the user out within the same tick that React can render, so the
    // "Re-encrypting Credentials" progress UI flashes and disappears before
    // an integration test can reliably observe it (see test 1's comments).
    // Render the progress component directly to verify its content instead.
    it('should show progress indicator during re-encryption', () => {
      render(<ReEncryptionProgress current={0} total={1} />);

      expect(screen.getByText(/re-encrypting credentials/i)).toBeInTheDocument();
      expect(screen.getByText(/0 of 1 credentials processed/i)).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();

      render(<ReEncryptionProgress current={1} total={1} />);
      expect(screen.getByText(/1 of 1 credentials processed/i)).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
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
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const changePasswordButton = screen.getByRole('button', { name: /change.*password/i });
      fireEvent.click(changePasswordButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /change master password/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify warning about re-encryption is displayed
      expect(
        screen.getByText(/this will re-encrypt all your credentials/i)
      ).toBeInTheDocument();
    });
  });
});
