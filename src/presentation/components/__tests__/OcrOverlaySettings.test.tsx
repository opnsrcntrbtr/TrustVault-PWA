import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { isNativeAndroidAppMock, saveOcrSettingsMock } = vi.hoisted(() => ({
  isNativeAndroidAppMock: vi.fn(() => true),
  saveOcrSettingsMock: vi.fn(),
}));

let current = { ocrShowBoundingBoxOverlay: false };
vi.mock('@/core/platform/runtime', () => ({
  isNativeAndroidApp: isNativeAndroidAppMock,
}));
vi.mock('@/core/ocr/ocrSettings', () => ({
  loadOcrSettings: () => current,
  saveOcrSettings: (s: typeof current) => { current = s; saveOcrSettingsMock(s); },
  DEFAULT_OCR_SETTINGS: { ocrShowBoundingBoxOverlay: false },
}));

import OcrOverlaySettings from '@/presentation/components/OcrOverlaySettings';

describe('OcrOverlaySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    current = { ocrShowBoundingBoxOverlay: false };
    isNativeAndroidAppMock.mockReturnValue(true);
  });

  it('renders nothing off the native Android surface', () => {
    isNativeAndroidAppMock.mockReturnValue(false);
    const { container } = render(<OcrOverlaySettings />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the toggle off by default on native Android', () => {
    render(<OcrOverlaySettings />);
    const toggle = screen.getByRole('checkbox', { name: /bounding box/i });
    expect(toggle).not.toBeChecked();
  });

  it('surfaces the Firebase / no-confidence trade-off in the help text', () => {
    render(<OcrOverlaySettings />);
    expect(screen.getByText(/firebase/i)).toBeInTheDocument();
  });

  it('persists the toggle via saveOcrSettings on change', () => {
    render(<OcrOverlaySettings />);
    const toggle = screen.getByRole('checkbox', { name: /bounding box/i });

    fireEvent.click(toggle);

    expect(saveOcrSettingsMock).toHaveBeenCalledWith({ ocrShowBoundingBoxOverlay: true });
    expect(toggle).toBeChecked();
  });
});
