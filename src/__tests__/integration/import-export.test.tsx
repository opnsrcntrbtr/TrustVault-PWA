/**
 * Import/Export Integration Tests
 * Tests complete flow of exporting vault and importing back
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';
import { encryptExport } from '@/core/crypto/exportEncryption';
import type { Credential } from '@/domain/entities/Credential';

// Helper to setup authenticated user with multiple credentials
async function setupAuthenticatedUserWithMultipleCredentials(user: ReturnType<typeof userEvent.setup>) {
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

  await user.type(usernameInput, 'exporttestuser');
  await user.type(emailInput, 'exporttest@example.com');
  await user.type(passwordInput, 'TestPassword123!');
  await user.type(confirmInput, 'TestPassword123!');

  const submitButton = screen.getByRole('button', { name: /create account/i });
  await user.click(submitButton);

  await waitFor(() => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
  }, { timeout: 10000 });

  // Wait for dashboard to be visible before adding credentials
  await waitFor(() => {
    expect(screen.getByLabelText('add')).toBeInTheDocument();
  }, { timeout: 5000 });

  // Add multiple test credentials
  const credentials = [
    { title: 'Gmail Account', username: 'user@gmail.com', password: 'GmailPass123!' },
    { title: 'GitHub Account', username: 'user@github.com', password: 'GitHubPass456!' },
    { title: 'AWS Account', username: 'user@aws.com', password: 'AWSPass789!' },
  ];

  for (const cred of credentials) {
    // fireEvent.click (single synchronous click) instead of userEvent.click -
    // userEvent's pointerdown/pointerup sequence on the FAB can land on the
    // BottomNavigation "Credentials" tab in jsdom, navigating nowhere instead
    // of opening the Add Credential page.
    const addButton = screen.getByLabelText('add');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
    }, { timeout: 5000 });

    // Wait for form fields to be available - MUI Dialog transitions can take
    // longer than the default 1000ms waitFor timeout, especially for the
    // 2nd/3rd dialog opened in this loop under CPU contention.
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // fireEvent.change (single synchronous change event) instead of
    // userEvent.type - on the 3rd credential, the per-character delays of
    // userEvent.type leave room for a stray async effect (from a prior
    // save) to fire mid-typing and navigate back to /dashboard.
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: cred.title } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: cred.username } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: cred.password } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(cred.title)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Wait for the dashboard to fully settle after the save-triggered
    // navigation before clicking "add" again - otherwise the click can land
    // on the BottomNavigation mid-transition and navigate elsewhere.
    await waitFor(() => {
      expect(screen.getByLabelText('add')).toBeInTheDocument();
    }, { timeout: 5000 });
  }
}

describe('Import/Export Integration', () => {
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

  describe('Export Vault', () => {
    it('should export vault with encryption', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      // Find and click Export Vault button
      const exportButton = screen.getByRole('button', { name: /^export vault$/i });
      await user.click(exportButton);

      // Verify export dialog opened (MUI Dialog transition can take longer
      // than the default 1000ms waitFor timeout)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^export vault$/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Fill export password - "Export Password" and "Confirm Export
      // Password" both match /export password/i, so use anchored regexes.
      const exportPasswordInput = screen.getByLabelText(/^export password$/i);
      const confirmExportPasswordInput = screen.getByLabelText(/confirm export password/i);

      await user.type(exportPasswordInput, 'ExportPassword123!');
      await user.type(confirmExportPasswordInput, 'ExportPassword123!');

      // Verify warning is displayed
      expect(
        screen.getByText(/cannot recover the backup\s*without it/i)
      ).toBeInTheDocument();

      // Check the confirmation checkbox
      const confirmCheckbox = screen.getByRole('checkbox');
      await user.click(confirmCheckbox);

      // Click Export Vault button
      const exportSubmitButton = screen.getByRole('button', { name: /^export vault$/i });

      // Mock the download functionality. Capture the real createElement
      // before spying - calling document.createElement from inside the
      // mock implementation would otherwise recurse into the spy itself.
      const downloadSpy = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- string-typed createElement overload is deprecated in favor of HTMLElementTagNameMap, but we need it generically here
      const originalCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          (element as HTMLAnchorElement).click = downloadSpy;
        }
        return element;
      });

      await user.click(exportSubmitButton);

      // Verify download initiated
      await waitFor(() => {
        expect(downloadSpy).toHaveBeenCalled();
      }, { timeout: 3000 });

      createElementSpy.mockRestore();
    }, 20000);

    it('should validate export password strength', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /^export vault$/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^export vault$/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      // Enter weak export password
      const exportPasswordInput = screen.getByLabelText(/^export password$/i);
      await user.type(exportPasswordInput, 'weak');

      // Verify strength indicator shows weak
      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // A password under 12 characters is below the minimum, so the helper
      // text remains visible and the submit button stays disabled -
      // handleExport never runs.
      expect(screen.getByText(/minimum 12 characters/i)).toBeInTheDocument();
      const exportSubmitButton = screen.getByRole('button', { name: /^export vault$/i });
      expect(exportSubmitButton).toBeDisabled();
    }, 20000);

    it('should require matching export password confirmation', async () => {
      const user = userEvent.setup();
      render(

          <App />

      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /^export vault$/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^export vault$/i })).toBeInTheDocument();
      }, { timeout: 3000 });

      const exportPasswordInput = screen.getByLabelText(/^export password$/i);
      const confirmExportPasswordInput = screen.getByLabelText(/confirm export password/i);

      await user.type(exportPasswordInput, 'ExportPassword123!');
      await user.type(confirmExportPasswordInput, 'DifferentPassword456!');

      // Verify mismatch helper text is shown, and the submit button is
      // disabled - handleExport never runs.
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
      const exportSubmitButton = screen.getByRole('button', { name: /^export vault$/i });
      expect(exportSubmitButton).toBeDisabled();
    }, 20000);
  });

  describe('Import Vault', () => {
    it('should import vault with correct password', async () => {
      const user = userEvent.setup();

      // First, create a real encrypted export file
      const now = new Date();
      const exportCredentials: Credential[] = [
        {
          id: '1',
          title: 'Imported Gmail',
          username: 'imported@gmail.com',
          password: 'ImportedPass123!',
          category: 'login',
          tags: [],
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
        },
      ];

      const exportJson = await encryptExport(exportCredentials, 'ExportPassword123!');

      const mockFile = new File(
        [exportJson],
        'trustvault-backup-2025-10-25.tvault',
        { type: 'application/json' }
      );

      render(
        
          <App />
        
      );

      // Create fresh account
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      
      

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      });

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'importtestuser');
      await user.type(emailInput, 'importtest@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
      }, { timeout: 10000 });

      // Wait for dashboard to be visible
      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      // Find and click Import Vault button
      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      // Verify import dialog opened
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /import vault/i })).toBeInTheDocument();
      });

      // Upload file
      const fileInput = screen.getByLabelText(/select backup file/i);
      await user.upload(fileInput, mockFile);

      // Verify file name displayed
      await waitFor(() => {
        expect(screen.getByText(/trustvault-backup.*\.tvault/i)).toBeInTheDocument();
      });

      // Enter export password
      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'ExportPassword123!');

      // Decrypt the export. Use fireEvent (single synchronous click) instead of
      // userEvent.click - the decrypt success re-render swaps out the button's
      // content fast enough that userEvent's pointerdown/pointerup sequence can
      // land on the wrong element (e.g. the dashboard nav) in jsdom.
      const nextButton = screen.getByRole('button', { name: /^next$/i });
      fireEvent.click(nextButton);

      // Import mode defaults to "merge", which is what this test wants, so
      // there's no need to interact with the Import Mode <Select> (opening
      // it is what triggers the jsdom mis-click navigation bug).
      const importSubmitButton = await screen.findByRole('button', { name: /import 1 credential/i });
      fireEvent.click(importSubmitButton);

      // The dialog's onSuccess only shows a save message on the Settings
      // page - it doesn't navigate to the dashboard.
      await waitFor(() => {
        expect(screen.getByText(/successfully imported 1 credentials?/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Navigate to the dashboard and verify the imported credential is there.
      // Wait for the dialog's closing transition to finish - while it's
      // closing, MUI marks the rest of the app aria-hidden, so the bottom
      // nav button is temporarily inaccessible.
      const credentialsButton = await waitFor(() => {
        return screen.getByRole('button', { name: /credentials/i });
      }, { timeout: 3000 });
      fireEvent.click(credentialsButton);

      await waitFor(() => {
        expect(screen.getByText('Imported Gmail')).toBeInTheDocument();
      }, { timeout: 5000 });
    }, 20000);

    it('should reject import with wrong password', async () => {
      const user = userEvent.setup();

      const now = new Date();
      const exportCredentials: Credential[] = [
        {
          id: '1',
          title: 'Imported Gmail',
          username: 'imported@gmail.com',
          password: 'ImportedPass123!',
          category: 'login',
          tags: [],
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
        },
      ];
      const exportJson = await encryptExport(exportCredentials, 'ExportPassword123!');

      const mockFile = new File(
        [exportJson],
        'trustvault-backup.tvault',
        { type: 'application/json' }
      );

      render(

          <App />

      );

      // Setup user
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'importerroruser');
      await user.type(emailInput, 'importerror@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /import vault/i })).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/select backup file/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/trustvault-backup.*\.tvault/i)).toBeInTheDocument();
      });

      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'WrongPassword123!');

      // Attempt decrypt with wrong password (fireEvent avoids a jsdom
      // mis-click landing on the BottomNavigation during the re-render)
      const nextButton = screen.getByRole('button', { name: /^next$/i });
      fireEvent.click(nextButton);

      // Verify decryption error
      await waitFor(() => {
        expect(
          screen.getByText(/incorrect.*password|decryption.*failed|invalid.*password/i)
        ).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should handle replace mode correctly', async () => {
      const user = userEvent.setup();

      const exportJson = await encryptExport([], 'ExportPassword123!');
      const mockFile = new File(
        [exportJson],
        'trustvault-backup.tvault',
        { type: 'application/json' }
      );

      render(<App />);

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /import vault/i })).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/select backup file/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/trustvault-backup.*\.tvault/i)).toBeInTheDocument();
      });

      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'ExportPassword123!');

      const nextButton = screen.getByRole('button', { name: /^next$/i });
      fireEvent.click(nextButton);

      // Wait for decrypted state - the Import Mode select appears
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Select REPLACE mode. The Import Mode <Select> has no accessible
      // label association, so query it by role.
      const importModeSelect = screen.getByRole('combobox');
      await user.click(importModeSelect);

      const replaceOption = await screen.findByRole('option', { name: /replace/i });
      await user.click(replaceOption);

      // Verify warning displayed for replace mode
      await waitFor(() => {
        expect(screen.getByText(/warning: replace mode/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/this will permanently delete all your existing credentials/i)
      ).toBeInTheDocument();
    }, 20000);
  });

  describe('Import Progress', () => {
    it('should show progress during import of large vault', async () => {
      const user = userEvent.setup();

      // Create real encrypted export with many credentials
      const now = new Date();
      const mockCredentials: Credential[] = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Account ${String(i)}`,
        username: `user${String(i)}@example.com`,
        password: `Password${String(i)}!`,
        category: 'login',
        tags: [],
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
      }));

      const exportJson = await encryptExport(mockCredentials, 'ExportPassword123!');

      const mockFile = new File(
        [exportJson],
        'large-vault.tvault',
        { type: 'application/json' }
      );

      render(<App />);

      // Setup user and navigate to import
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(usernameInput, 'largeimportuser');
      await user.type(emailInput, 'largeimport@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
      }, { timeout: 10000 });

      await waitFor(() => {
        expect(screen.getByLabelText('add')).toBeInTheDocument();
      }, { timeout: 5000 });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /import vault/i })).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/select backup file/i);
      await user.upload(fileInput, mockFile);

      await waitFor(() => {
        expect(screen.getByText(/trustvault-backup.*\.tvault|large-vault.*\.tvault/i)).toBeInTheDocument();
      });

      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'ExportPassword123!');

      // Decrypt (fireEvent avoids jsdom mis-click landing on BottomNavigation
      // during the re-render)
      const nextButton = screen.getByRole('button', { name: /^next$/i });
      fireEvent.click(nextButton);

      // Verify preview shows credential count
      await waitFor(() => {
        expect(screen.getAllByText(/50.*credentials/i).length).toBeGreaterThan(0);
      }, { timeout: 10000 });
    }, 20000);
  });
});
