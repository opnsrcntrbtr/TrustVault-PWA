/**
 * Clipboard Utilities
 * Secure clipboard operations with auto-clear functionality
 * Enhanced with SecureClipboardManager for countdown notifications
 */

/**
 * Clipboard event callback types
 */
export type ClipboardCountdownCallback = (remaining: number) => void;
export type ClipboardClearCallback = () => void;

/**
 * Copy text to clipboard with auto-clear after specified duration
 * @param text - Text to copy to clipboard
 * @param clearAfterMs - Duration in milliseconds before clearing clipboard (default: 30000ms = 30s)
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(
  text: string,
  clearAfterMs: number = 30000
): Promise<boolean> {
  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);

      // Schedule clipboard clear
      if (clearAfterMs > 0) {
        setTimeout(async () => {
          try {
            // Only clear if the clipboard still contains our text
            const currentClipboard = await navigator.clipboard.readText();
            if (currentClipboard === text) {
              await navigator.clipboard.writeText('');
            }
          } catch (error) {
            // Ignore errors when clearing (user might have denied permission)
            console.debug('Could not auto-clear clipboard:', error);
          }
        }, clearAfterMs);
      }

      return true;
    }

    // Fallback for older browsers
    return fallbackCopyToClipboard(text);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    // Try fallback method
    return fallbackCopyToClipboard(text);
  }
}

/**
 * Fallback clipboard copy method for older browsers
 * Creates a temporary textarea element to copy text
 */
function fallbackCopyToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea invisible and position it off-screen
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);

    // Select and copy
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');

    // Clean up
    document.body.removeChild(textArea);

    return successful;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    return false;
  }
}

/**
 * Copy password to clipboard with security features
 * - Auto-clears after 30 seconds (configurable)
 * - Returns success status
 * @param password - Password to copy
 * @param clearAfterSeconds - Duration in seconds before clearing (default: 30)
 */
export async function copyPassword(
  password: string,
  clearAfterSeconds: number = 30
): Promise<boolean> {
  return copyToClipboard(password, clearAfterSeconds * 1000);
}

/**
 * Copy username to clipboard
 * - Does not auto-clear (usernames are less sensitive)
 * @param username - Username to copy
 */
export async function copyUsername(username: string): Promise<boolean> {
  return copyToClipboard(username, 0); // No auto-clear for usernames
}

/**
 * Check if clipboard API is available
 */
export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

/**
 * Get remaining time before clipboard auto-clear
 * This is a helper for showing countdown timers
 * @param copiedAt - Timestamp when text was copied
 * @param clearAfterSeconds - Duration before clearing
 * @returns Remaining seconds, or 0 if already cleared
 */
export function getRemainingClearTime(
  copiedAt: number,
  clearAfterSeconds: number
): number {
  const elapsed = (Date.now() - copiedAt) / 1000;
  const remaining = Math.max(0, clearAfterSeconds - elapsed);
  return Math.ceil(remaining);
}

/**
 * Format remaining time as human-readable string
 * @param seconds - Remaining seconds
 * @returns Formatted string like "29s" or "1m 30s"
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '0s';

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Secure Clipboard Manager
 * Manages clipboard operations with auto-clear timers and countdown notifications
 */
export class SecureClipboardManager {
  private clearTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private copiedText: string = '';
  private remaining: number = 0;
  private onCountdownCallback: ClipboardCountdownCallback | null = null;
  private onClearCallback: ClipboardClearCallback | null = null;

  /**
   * Copy text to clipboard with optional auto-clear
   * @param text - Text to copy
   * @param isSensitive - Whether this is sensitive data (passwords, etc.)
   * @param clearAfterSeconds - Duration before clearing (0 = no auto-clear)
   * @returns Promise that resolves to true if successful
   */
  async copy(
    text: string,
    isSensitive: boolean = false,
    clearAfterSeconds: number = 30
  ): Promise<boolean> {
    try {
      // Cancel any existing timers
      this.cancelTimers();

      // Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const success = fallbackCopyToClipboard(text);
        if (!success) return false;
      }

      // Store copied text for verification
      this.copiedText = text;

      // Start auto-clear timer if sensitive and clearAfterSeconds > 0
      if (isSensitive && clearAfterSeconds > 0) {
        this.startClearTimer(clearAfterSeconds);
      }

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Start the auto-clear timer with countdown
   */
  private startClearTimer(seconds: number): void {
    this.remaining = seconds;

    // Notify initial countdown
    this.onCountdownCallback?.(this.remaining);

    // Start countdown timer (updates every second)
    this.countdownTimer = setInterval(() => {
      this.remaining--;
      this.onCountdownCallback?.(this.remaining);

      if (this.remaining <= 0) {
        this.clearClipboard();
      }
    }, 1000);

    // Failsafe: clear after exact duration
    this.clearTimer = setTimeout(() => {
      this.clearClipboard();
    }, seconds * 1000);
  }

  /**
   * Clear the clipboard
   */
  private async clearClipboard(): Promise<void> {
    try {
      // Only clear if clipboard still contains our text
      if (navigator.clipboard && navigator.clipboard.readText) {
        const current = await navigator.clipboard.readText();
        if (current === this.copiedText) {
          await navigator.clipboard.writeText('');
        }
      } else {
        // Fallback: just clear regardless
        await navigator.clipboard.writeText('');
      }
    } catch (error) {
      console.debug('Could not clear clipboard:', error);
    }

    this.cancelTimers();
    this.onClearCallback?.();
  }

  /**
   * Cancel all active timers
   */
  cancelTimers(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.remaining = 0;
    this.copiedText = '';
  }

  /**
   * Set countdown callback
   */
  onCountdown(callback: ClipboardCountdownCallback): void {
    this.onCountdownCallback = callback;
  }

  /**
   * Set clear callback
   */
  onClear(callback: ClipboardClearCallback): void {
    this.onClearCallback = callback;
  }

  /**
   * Get remaining time
   */
  getRemaining(): number {
    return this.remaining;
  }

  /**
   * Check if there's an active timer
   */
  isActive(): boolean {
    return this.clearTimer !== null;
  }
}

/**
 * Singleton instance of SecureClipboardManager
 */
export const clipboardManager = new SecureClipboardManager();
