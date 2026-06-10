/**
 * TrustVault Autofill - Popup Script
 */

// Get current tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Load settings
async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings || {
    enabled: false,
    requireConfirmation: true,
    httpsOnly: true,
  };

  document.getElementById('autofill-enabled').checked = settings.enabled;
  document.getElementById('require-confirmation').checked = settings.requireConfirmation;
  document.getElementById('https-only').checked = settings.httpsOnly;
}

// Save settings
async function saveSettings() {
  const settings = {
    enabled: document.getElementById('autofill-enabled').checked,
    requireConfirmation: document.getElementById('require-confirmation').checked,
    httpsOnly: document.getElementById('https-only').checked,
  };

  await chrome.storage.local.set({ settings });
  showStatus('Settings saved', false);
}

// Load credentials count for current site
// Credentials are never persisted in extension storage (the encrypted vault
// lives in the PWA), so until a secure on-demand transport exists there is
// nothing available to fill.
async function loadCredentialsCount() {
  const tab = await getCurrentTab();

  if (!tab || !tab.url) {
    document.getElementById('credentials-count').textContent = '—';
    return;
  }

  document.getElementById('credentials-count').textContent = '0';
}

// Show status message
function showStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  const statusText = document.getElementById('status-text');

  statusText.textContent = message;
  statusEl.className = isError ? 'status error' : 'status';
  statusEl.style.display = 'flex';

  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCredentialsCount();

  // Settings listeners
  document.getElementById('autofill-enabled').addEventListener('change', saveSettings);
  document.getElementById('require-confirmation').addEventListener('change', saveSettings);
  document.getElementById('https-only').addEventListener('change', saveSettings);

  // Open TrustVault button
  document.getElementById('open-trustvault').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_TRUSTVAULT' });
    window.close();
  });

  // Manage credentials button
  document.getElementById('manage-credentials').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_TRUSTVAULT' });
    window.close();
  });

  // Check TrustVault accessibility
  chrome.runtime.sendMessage({ type: 'CHECK_ACCESSIBILITY' }, (response) => {
    if (response && response.accessible) {
      showStatus('Connected to TrustVault', false);
    } else {
      showStatus('TrustVault not accessible', true);
    }
  });
});
