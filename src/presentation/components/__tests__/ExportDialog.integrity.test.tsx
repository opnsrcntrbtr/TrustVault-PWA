import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportDialog from '../ExportDialog';

vi.mock('@/core/crypto/exportEncryption', () => ({
  encryptExport: vi.fn(() => Promise.resolve('{}')),
  generateExportFilename: () => 'x.tvault',
  downloadExportFile: vi.fn(),
}));
vi.mock('@/data/repositories/CredentialRepositoryImpl', () => ({
  credentialRepository: { findAll: vi.fn(() => Promise.resolve([{ id: 'a' }, { id: 'b', integrityError: true }])) },
}));
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ session: { vaultKey: {}, userId: 'u1' } }),
}));
vi.mock('../PasswordStrengthIndicator', () => ({ default: () => null }));

describe('ExportDialog integrity notice', () => {
  it('says how many credentials were left out and stays open', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<ExportDialog open onClose={onClose} onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText(/^Export Password/), 'LongExportPassword1');
    await user.type(screen.getByLabelText(/^Confirm Export Password/), 'LongExportPassword1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Export Vault' }));
    expect(await screen.findByText(/1 credential failed the integrity check and was not included/)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  }, 30000);
});
