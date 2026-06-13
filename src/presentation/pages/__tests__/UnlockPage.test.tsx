/**
 * UnlockPage Tests
 *
 * Regression coverage for the re-unlock session bug: after a page reload
 * (or auto-lock), `useAuthStore().session` is null because it is never
 * persisted. Re-unlocking via master password or biometric must restore
 * `session` (not just `vaultKey`/`isLocked`), since ExportDialog/ImportDialog
 * gate their entire flow on `session?.vaultKey` and `session.userId`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UnlockPage from '../UnlockPage';
import { useAuthStore } from '../../store/authStore';
import { userRepository } from '@/data/repositories/UserRepositoryImpl';
import type { User, AuthSession } from '@/domain/entities/User';

vi.mock('@/data/repositories/UserRepositoryImpl', () => ({
  userRepository: {
    authenticateWithPassword: vi.fn(),
    authenticateWithBiometric: vi.fn(),
    getFirstBiometricCredential: vi.fn(),
    findById: vi.fn(),
  },
}));

const mockVaultKey = {} as CryptoKey;

const fullUser: User = {
  id: 'user-1',
  username: 'unlockuser',
  hashedMasterPassword: 'scrypt$17$8$1$salt$hash',
  encryptedVaultKey: 'encrypted-vault-key',
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
    passwordGenerationLength: 16,
    twoFactorEnabled: false,
  },
};

const mockSession: AuthSession = {
  userId: 'user-1',
  vaultKey: mockVaultKey,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  isLocked: false,
};

describe('UnlockPage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mock factory below replaces these with plain vi.fn()s
    vi.mocked(userRepository.getFirstBiometricCredential).mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mock factory below replaces these with plain vi.fn()s
    vi.mocked(userRepository.authenticateWithPassword).mockResolvedValue(mockSession);

    // Simulate post-reload state: user persisted (shell promoted to full user
    // here for simplicity), but `session` was wiped because it is not part
    // of the persisted auth shell.
    useAuthStore.setState({
      user: fullUser,
      session: null,
      isAuthenticated: true,
      isLocked: true,
      vaultKey: null,
    });
  });

  it('restores session (not just vaultKey) after master-password unlock', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UnlockPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/master password/i);
    await user.type(passwordInput, 'TestPassword123!');

    const unlockButton = screen.getByRole('button', { name: /unlock vault/i });
    await user.click(unlockButton);

    await waitFor(() => {
      expect(useAuthStore.getState().vaultKey).toBe(mockVaultKey);
    });

    const state = useAuthStore.getState();
    expect(state.session).not.toBeNull();
    expect(state.session?.userId).toBe(mockSession.userId);
    expect(state.session?.vaultKey).toBe(mockVaultKey);
  });

  it('restores session (not just vaultKey) after biometric unlock', async () => {
    const user = userEvent.setup();

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mock factory above replaces these with plain vi.fn()s
    vi.mocked(userRepository.getFirstBiometricCredential).mockResolvedValue('cred-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.mock factory above replaces these with plain vi.fn()s
    vi.mocked(userRepository.authenticateWithBiometric).mockResolvedValue(mockSession);

    render(
      <MemoryRouter>
        <UnlockPage />
      </MemoryRouter>
    );

    const biometricButton = await screen.findByRole('button', { name: /use biometric/i });
    await user.click(biometricButton);

    await waitFor(() => {
      expect(useAuthStore.getState().vaultKey).toBe(mockVaultKey);
    });

    const state = useAuthStore.getState();
    expect(state.session).not.toBeNull();
    expect(state.session?.userId).toBe(mockSession.userId);
    expect(state.session?.vaultKey).toBe(mockVaultKey);
  });
});
