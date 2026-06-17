import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BackupCodeInput from '../BackupCodeInput';
import { generateBackupCodes } from '@/core/auth/backupCodes';

describe('BackupCodeInput', () => {
  let codes: ReturnType<typeof generateBackupCodes>;
  let onSuccess: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    codes = generateBackupCodes(12);
    onSuccess = vi.fn();
    onCancel = vi.fn();
  });

  it('renders the recovery title', () => {
    render(
      <BackupCodeInput
        credentialTitle="Gmail"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(/Recover access to "Gmail"/i)).toBeInTheDocument();
  });

  it('accepts valid 8-digit code', async () => {
    const user = userEvent.setup();
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const input = screen.getByPlaceholderText('e.g., 12345678');
    const firstCode = codes[0]!.code;

    await user.type(input, firstCode);
    fireEvent.click(screen.getByRole('button', { name: /use this code/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(codes[0]);
    });
  });

  it('accepts code with space', async () => {
    const user = userEvent.setup();
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const input = screen.getByPlaceholderText('e.g., 12345678');
    const firstCode = codes[0]!.code;
    const codeWithSpace = `${firstCode.slice(0, 4)} ${firstCode.slice(4)}`;

    await user.type(input, codeWithSpace);
    fireEvent.click(screen.getByRole('button', { name: /use this code/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(codes[0]);
    });
  });

  it('shows error for invalid format', async () => {
    const user = userEvent.setup();
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const input = screen.getByPlaceholderText('e.g., 12345678');
    await user.type(input, '1234567'); // 7 digits

    fireEvent.click(screen.getByRole('button', { name: /use this code/i }));

    expect(screen.getByText('Code must be 8 digits')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows error for code not found', async () => {
    const user = userEvent.setup();
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const input = screen.getByPlaceholderText('e.g., 12345678');
    await user.type(input, '99999999');

    fireEvent.click(screen.getByRole('button', { name: /use this code/i }));

    await waitFor(() => {
      expect(screen.getByText(/code doesn't exist/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows error for already-consumed code', async () => {
    const user = userEvent.setup();
    const consumedCode = { ...codes[0]!, consumed: true, lastUsedAt: Date.now() };
    const updatedCodes = [consumedCode, ...codes.slice(1)];

    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={updatedCodes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const input = screen.getByPlaceholderText('e.g., 12345678');
    await user.type(input, consumedCode.code);

    fireEvent.click(screen.getByRole('button', { name: /use this code/i }));

    await waitFor(() => {
      expect(screen.getByText(/already used/i)).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables submit button until code entered', async () => {
    const user = userEvent.setup();
    render(
      <BackupCodeInput
        credentialTitle="Test"
        backupCodes={codes}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /use this code/i });
    expect(submitButton).toBeDisabled();

    const input = screen.getByPlaceholderText('e.g., 12345678');
    await user.type(input, '1234567'); // Any input enables it

    expect(submitButton).not.toBeDisabled();

    // Clear and verify disabled again
    await user.clear(input);
    expect(submitButton).toBeDisabled();
  });
});
