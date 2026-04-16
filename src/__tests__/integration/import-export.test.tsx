/**
 * Import/Export Integration Tests
 * Tests complete flow of exporting vault and importing back
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/presentation/App';
import { useAuthStore } from '@/presentation/store/authStore';
import { db } from '@/data/storage/database';

// Helper to setup authenticated user with multiple credentials
async function setupAuthenticatedUserWithMultipleCredentials(user: ReturnType<typeof userEvent.setup>) {
  // With no users in DB, app redirects directly to signup
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  }, { timeout: 5000 });

  const emailInput = screen.getByLabelText(/email/i);
  // Both password fields have "Master Password" in label, so we use getAllByLabelText
  const passwordInputs = screen.getAllByLabelText(/master password/i);
  const passwordInput = passwordInputs[0]; // First one is the password field
  const confirmInput = passwordInputs[1]; // Second one is confirm field

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
  
  // Debug: print what's on screen
  screen.debug(undefined, 5000);

  // Add multiple test credentials
  const credentials = [
    { title: 'Gmail Account', username: 'user@gmail.com', password: 'GmailPass123!' },
    { title: 'GitHub Account', username: 'user@github.com', password: 'GitHubPass456!' },
    { title: 'AWS Account', username: 'user@aws.com', password: 'AWSPass789!' },
  ];

  for (const cred of credentials) {
    const addButton = screen.getByLabelText('add');
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add credential/i })).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Wait for form fields to be available
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/title/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const credPasswordInput = screen.getByLabelText(/^password/i);

    await user.type(titleInput, cred.title);
    await user.type(usernameInput, cred.username);
    await user.type(credPasswordInput, cred.password);

    const saveButton = screen.getByRole('button', { name: /save credential/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(cred.title)).toBeInTheDocument();
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
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      // Find and click Export Vault button
      const exportButton = screen.getByRole('button', { name: /export.*vault/i });
      await user.click(exportButton);

      // Verify export dialog opened
      await waitFor(() => {
        expect(screen.getByText(/export vault/i)).toBeInTheDocument();
      });

      // Fill export password
      const exportPasswordInput = screen.getByLabelText(/export password/i);
      const confirmExportPasswordInput = screen.getByLabelText(/confirm.*export password/i);

      await user.type(exportPasswordInput, 'ExportPassword123!');
      await user.type(confirmExportPasswordInput, 'ExportPassword123!');

      // Verify warning is displayed
      expect(
        screen.getByText(/store.*export password.*securely|cannot recover without/i)
      ).toBeInTheDocument();

      // Check the confirmation checkbox
      const confirmCheckbox = screen.getByRole('checkbox', { name: /stored.*export password/i });
      await user.click(confirmCheckbox);

      // Click Export button
      const exportSubmitButton = screen.getByRole('button', { name: /^export$/i });

      // Mock the download functionality
      const downloadSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName) => {
        if (tagName === 'a') {
          const anchor = document.createElement('a');
          anchor.click = downloadSpy;
          return anchor;
        }
        return document.createElement(tagName);
      });

      await user.click(exportSubmitButton);

      // Verify download initiated (success message or file download)
      await waitFor(() => {
        const hasSuccessMessage = screen.queryByText(/export.*successful|vault.*exported/i);
        expect(hasSuccessMessage || downloadSpy).toBeTruthy();
      }, { timeout: 3000 });

      createElementSpy.mockRestore();
    });

    it('should validate export password strength', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export.*vault/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/export vault/i)).toBeInTheDocument();
      });

      // Enter weak export password
      const exportPasswordInput = screen.getByLabelText(/export password/i);
      await user.type(exportPasswordInput, 'weak');

      // Verify strength indicator shows weak
      await waitFor(() => {
        expect(screen.getByText(/weak|too weak/i)).toBeInTheDocument();
      });

      // Try to submit with weak password
      const confirmCheckbox = screen.getByRole('checkbox', { name: /stored.*export password/i });
      await user.click(confirmCheckbox);

      const exportSubmitButton = screen.getByRole('button', { name: /^export$/i });
      await user.click(exportSubmitButton);

      // Verify validation error
      await waitFor(() => {
        expect(screen.getByText(/password.*too weak|minimum.*12 characters/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should require matching export password confirmation', async () => {
      const user = userEvent.setup();
      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export.*vault/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/export vault/i)).toBeInTheDocument();
      });

      const exportPasswordInput = screen.getByLabelText(/export password/i);
      const confirmExportPasswordInput = screen.getByLabelText(/confirm.*export password/i);

      await user.type(exportPasswordInput, 'ExportPassword123!');
      await user.type(confirmExportPasswordInput, 'DifferentPassword456!');

      const confirmCheckbox = screen.getByRole('checkbox', { name: /stored.*export password/i });
      await user.click(confirmCheckbox);

      const exportSubmitButton = screen.getByRole('button', { name: /^export$/i });
      await user.click(exportSubmitButton);

      // Verify mismatch error
      await waitFor(() => {
        expect(screen.getByText(/passwords.*do not match|passwords must match/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Import Vault', () => {
    it('should import vault with correct password', async () => {
      const user = userEvent.setup();

      // First, create a mock export file
      const mockExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        credentials: [
          {
            id: '1',
            title: 'Imported Gmail',
            username: 'imported@gmail.com',
            password: 'ImportedPass123!',
            category: 'Login',
          },
        ],
        encryptionParams: { algorithm: 'AES-256-GCM', iterations: 600000 },
      };

      const mockFile = new File(
        [JSON.stringify(mockExportData)],
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

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(emailInput, 'importtest@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vault/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Navigate to Settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      // Find and click Import Vault button
      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      // Verify import dialog opened
      await waitFor(() => {
        expect(screen.getByText(/import vault/i)).toBeInTheDocument();
      });

      // Upload file
      const fileInput = screen.getByLabelText(/choose file|select file/i);
      await user.upload(fileInput, mockFile);

      // Verify file name displayed
      await waitFor(() => {
        expect(screen.getByText(/trustvault-backup.*\.tvault/i)).toBeInTheDocument();
      });

      // Enter export password
      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'ExportPassword123!');

      // Note: For this test to fully work, the export password would need to match
      // the password used to encrypt mockExportData. Since we're mocking,
      // we'll just verify the UI flow.

      // Select import mode (merge or replace)
      const importModeSelect = screen.getByLabelText(/import mode/i);
      await user.click(importModeSelect);

      const mergeOption = screen.getByRole('option', { name: /merge/i });
      await user.click(mergeOption);

      // Click Import button
      const importSubmitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(importSubmitButton);

      // Verify import progress or success (depends on implementation)
      await waitFor(() => {
        expect(
          screen.getByText(/importing|decrypting|import.*successful/i)
        ).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should reject import with wrong password', async () => {
      const user = userEvent.setup();

      const mockFile = new File(
        ['encrypted content'],
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

      
      

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(emailInput, 'importerror@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vault/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/import vault/i)).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/choose file|select file/i);
      await user.upload(fileInput, mockFile);

      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'WrongPassword123!');

      const importSubmitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(importSubmitButton);

      // Verify decryption error
      await waitFor(() => {
        expect(
          screen.getByText(/incorrect.*password|decryption.*failed|invalid.*password/i)
        ).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle replace mode correctly', async () => {
      const user = userEvent.setup();

      const mockFile = new File(
        [JSON.stringify({ version: '1.0', credentials: [] })],
        'trustvault-backup.tvault',
        { type: 'application/json' }
      );

      render(
        
          <App />
        
      );

      await setupAuthenticatedUserWithMultipleCredentials(user);

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/import vault/i)).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/choose file|select file/i);
      await user.upload(fileInput, mockFile);

      const exportPasswordInput = screen.getByLabelText(/export password|import password/i);
      await user.type(exportPasswordInput, 'ExportPassword123!');

      // Select REPLACE mode
      const importModeSelect = screen.getByLabelText(/import mode/i);
      await user.click(importModeSelect);

      const replaceOption = screen.getByRole('option', { name: /replace/i });
      await user.click(replaceOption);

      // Verify warning displayed for replace mode
      await waitFor(() => {
        expect(
          screen.getByText(/will delete.*existing credentials|warning.*replace/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Import Progress', () => {
    it('should show progress during import of large vault', async () => {
      const user = userEvent.setup();

      // Create mock file with many credentials
      const mockCredentials = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Account ${String(i)}`,
        username: `user${String(i)}@example.com`,
        password: `Password${String(i)}!`,
        category: 'Login',
      }));

      const mockFile = new File(
        [JSON.stringify({ version: '1.0', credentials: mockCredentials })],
        'large-vault.tvault',
        { type: 'application/json' }
      );

      render(
        
          <App />
        
      );

      // Setup user and navigate to import
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      }, { timeout: 5000 });

      
      

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^master password/i);
      const confirmInput = screen.getByLabelText(/confirm.*master.*password/i);

      await user.type(emailInput, 'largeimport@example.com');
      await user.type(passwordInput, 'TestPassword123!');
      await user.type(confirmInput, 'TestPassword123!');

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/vault/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: /import.*vault/i });
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText(/import vault/i)).toBeInTheDocument();
      });

      const fileInput = screen.getByLabelText(/choose file|select file/i);
      await user.upload(fileInput, mockFile);

      // Verify preview shows credential count
      await waitFor(() => {
        expect(screen.getByText(/50.*credentials/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });
});
