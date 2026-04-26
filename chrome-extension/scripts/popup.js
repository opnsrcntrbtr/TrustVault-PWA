/**
 * TrustVault Autofill - Popup Script
 * Stores only non-secret settings. Credential requests are explicit and
 * short-lived through the background bridge.
 */

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings || {
    enabled: true,
    requireConfirmation: true,
    httpsOnly: true,
  };

  document.getElementById('autofill-enabled').checked = settings.enabled;
  document.getElementById('require-confirmation').checked = settings.requireConfirmation;
  document.getElementById('https-only').checked = settings.httpsOnly;
}

async function saveSettings() {
  const settings = {
    enabled: document.getElementById('autofill-enabled').checked,
    requireConfirmation: document.getElementById('require-confirmation').checked,
    httpsOnly: document.getElementById('https-only').checked,
  };

  await chrome.storage.local.set({ settings });
  showStatus('Settings saved', false);
}

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

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();

  document.getElementById('autofill-enabled').addEventListener('change', saveSettings);
  document.getElementById('require-confirmation').addEventListener('change', saveSettings);
  document.getElementById('https-only').addEventListener('change', saveSettings);

  document.getElementById('open-trustvault').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_TRUSTVAULT' });
    window.close();
  });

  document.getElementById('manage-credentials').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_TRUSTVAULT' });
    window.close();
  });

  document.getElementById('request-fill').addEventListener('click', async () => {
    const settings = (await chrome.storage.local.get('settings')).settings || {};
    if (settings.enabled === false) {
      showStatus('Autofill is disabled', true);
      return;
    }

    const response = await sendRuntimeMessage({ type: 'START_CREDENTIAL_REQUEST' });
    if (response.success) {
      showStatus('Open TrustVault to approve this fill request', false);
      return;
    }

    showStatus(response.error || 'Could not start fill request', true);
  });

  chrome.runtime.sendMessage({ type: 'CHECK_ACCESSIBILITY' }, (response) => {
    if (response && response.accessible) {
      showStatus('Connected to TrustVault', false);
    } else {
      showStatus('TrustVault not accessible', true);
    }
  });
});
