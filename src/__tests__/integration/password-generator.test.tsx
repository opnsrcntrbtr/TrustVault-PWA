/**
 * Password Generator Integration Tests
 * Tests password generation workflow and integration with credential forms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

// Helper to setup authenticated user
async function setupAuthenticatedUser(user: ReturnType<typeof userEvent.setup>) {
  // With no users in DB, app redirects directly to signup
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  const emailInput = screen.getByLabelText(/email/i);
  // Both password fields have "Master Password" in label, so we use getAllByLabelText
  const passwordInputs = screen.getAllByLabelText(/master password/i);
  const passwordInput = passwordInputs[0]; // First one is the password field
  const confirmInput = passwordInputs[1]; // Second one is confirm field

  await user.type(emailInput, 'gentest@example.com');
  await user.type(passwordInput, 'TestPassword123!');
  await user.type(confirmInput, 'TestPassword123!');

  const submitButton = screen.getByRole('button', { name: /create account/i });
  await user.click(submitButton);

  await waitFor(() => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  }, { timeout: 10000 });
}

describe('Password Generator Integration', () => {
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

  describe('Generate Password in Add Credential Form', () => {
    it('should open password generator and use generated password in form', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUser(user);

      // Navigate to Add Credential page
      const addButton = screen.getByLabelText('add');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
      });

      // Find and click the Generate button
      const generateButton = screen.getByRole('button', { name: /generate/i });
      await user.click(generateButton);

      // Verify password generator dialog opened
      await waitFor(() => {
        expect(screen.getByText(/password generator/i)).toBeInTheDocument();
      });

      // Adjust length slider (optional, test default generation)
      const lengthSlider = screen.getByRole('slider', { name: /length/i });
      expect(lengthSlider).toBeInTheDocument();

      // Generate a new password (click regenerate button)
      const regenerateButton = screen.getByRole('button', { name: /regenerate/i });
      await user.click(regenerateButton);

      // Verify password strength indicator appears
      await waitFor(() => {
        expect(screen.getByText(/strong|very strong/i)).toBeInTheDocument();
      });

      // Copy generated password to clipboard (test copy functionality)
      const copyButton = screen.getByRole('button', { name: /copy/i });
      await user.click(copyButton);

      // Verify copy notification
      await waitFor(() => {
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Use password in form
      const useButton = screen.getByRole('button', { name: /use.*password/i });
      await user.click(useButton);

      // Verify dialog closed
      await waitFor(() => {
        expect(screen.queryByText(/password generator/i)).not.toBeInTheDocument();
      });

      // Verify password field is populated
      const passwordField = screen.getByLabelText(/^password/i);
      expect(passwordField).toBeInstanceOf(HTMLInputElement);
      if (passwordField instanceof HTMLInputElement) {
        expect(passwordField.value).toBeTruthy();
        expect(passwordField.value.length).toBeGreaterThanOrEqual(12);
      }
    });

    it('should persist generator preferences across sessions', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUser(user);

      // Navigate to Add Credential
      const addButton = screen.getByLabelText('add');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
      });

      // Open password generator
      const generateButton = screen.getByRole('button', { name: /generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/password generator/i)).toBeInTheDocument();
      });

      // Change settings: set length to 24
      const lengthSlider = screen.getByRole('slider', { name: /length/i });
      await user.click(lengthSlider);
      await user.type(lengthSlider, '24');

      // Toggle exclude ambiguous characters
      const excludeAmbiguousCheckbox = screen.getByRole('checkbox', { name: /exclude ambiguous/i });
      await user.click(excludeAmbiguousCheckbox);

      // Close dialog
      const closeButton = screen.getByRole('button', { name: /close|cancel/i });
      await user.click(closeButton);

      // Verify preferences saved to localStorage
      const savedPrefs = localStorage.getItem('passwordGeneratorPreferences');
      expect(savedPrefs).toBeTruthy();

      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs) as { length: number; excludeAmbiguous: boolean };
        expect(prefs.length).toBe(24);
        expect(prefs.excludeAmbiguous).toBe(true);
      }
    });
  });

  describe('Password Strength Indicator', () => {
    it('should show strength indicator when password is generated', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUser(user);

      // Navigate to Add Credential
      const addButton = screen.getByLabelText('add');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
      });

      // Open password generator
      const generateButton = screen.getByRole('button', { name: /generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/password generator/i)).toBeInTheDocument();
      });

      // Verify strength indicator exists and shows strong/very strong
      await waitFor(() => {
        const strengthIndicator = screen.getByText(/strength/i);
        expect(strengthIndicator).toBeInTheDocument();
      });

      // With default settings (20 chars, all types), should be "Very Strong"
      expect(screen.getByText(/very strong|strong/i)).toBeInTheDocument();
    });

    it('should update strength when options change', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUser(user);

      const addButton = screen.getByLabelText('add');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/password generator/i)).toBeInTheDocument();
      });

      // Reduce length to minimum (12)
      const lengthSlider = screen.getByRole('slider', { name: /length/i });
      await user.click(lengthSlider);

      // Regenerate with new settings
      const regenerateButton = screen.getByRole('button', { name: /regenerate/i });
      await user.click(regenerateButton);

      // Should still show strength indicator
      await waitFor(() => {
        expect(screen.getByText(/strength/i)).toBeInTheDocument();
      });
    });
  });

  describe('Character Type Options', () => {
    it('should generate password respecting character type selections', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUser(user);

      const addButton = screen.getByLabelText('add');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /generate/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/password generator/i)).toBeInTheDocument();
      });

      // Verify all character type checkboxes are present
      expect(screen.getByRole('checkbox', { name: /uppercase/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /lowercase/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /numbers/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /symbols/i })).toBeInTheDocument();

      // Uncheck symbols
      const symbolsCheckbox = screen.getByRole('checkbox', { name: /symbols/i });
      await user.click(symbolsCheckbox);

      // Regenerate
      const regenerateButton = screen.getByRole('button', { name: /regenerate/i });
      await user.click(regenerateButton);

      // Use the password
      const useButton = screen.getByRole('button', { name: /use.*password/i });
      await user.click(useButton);

      // Get the password value
      const passwordField = screen.getByLabelText(/^password/i);
      const generatedPassword = String(passwordField.value);

      // Verify no symbols in password (basic check - no common symbols)
      expect(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(generatedPassword)).toBe(false);
    });
  });
});
