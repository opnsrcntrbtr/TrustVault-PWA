import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BackupCodesModal from '../BackupCodesModal';
import { generateBackupCodes } from '@/core/auth/backupCodes';

describe('BackupCodesModal', () => {
  let codes: ReturnType<typeof generateBackupCodes>;
  let onConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    codes = generateBackupCodes(12);
    onConfirm = vi.fn();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  it('displays all 12 codes in a grid', () => {
    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} />);

    codes.forEach((bc) => {
      expect(screen.getByText(bc.code)).toBeInTheDocument();
    });
  });

  it('renders the title', () => {
    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders the warning message', () => {
    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} />);
    expect(screen.getByText(/Keep these safe/i)).toBeInTheDocument();
  });

  it('copy button calls onConfirm only when confirmed checkbox is checked', () => {
    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} />);

    const doneButton = screen.getByRole('button', { name: /done/i });
    expect(doneButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(doneButton).not.toBeDisabled();
    fireEvent.click(doneButton);

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('copy all button copies all codes space-separated', async () => {
    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} />);

    const copyAllButton = screen.getByRole('button', { name: /copy all/i });
    fireEvent.click(copyAllButton);

    await waitFor(() => {
      const expectedText = codes.map((bc) => bc.code).join(' ');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedText);
    });

    expect(screen.getByText('All codes copied!')).toBeInTheDocument();
  });

  it('download button initiates file download', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    render(<BackupCodesModal codes={codes} onConfirm={onConfirm} />);

    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);

    // Verify an anchor element was created and clicked
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
