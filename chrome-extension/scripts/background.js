/**
 * TrustVault Autofill - Background Service Worker
 * Handles communication between content scripts and TrustVault PWA
 */

const TRUSTVAULT_ORIGIN = 'https://trust-vault-pwa.vercel.app';
const TRUSTVAULT_LOCAL = 'http://localhost:3000';

/**
 * Check if TrustVault PWA is accessible
 */
async function isTrustVaultAccessible() {
  try {
    const response = await fetch(`${TRUSTVAULT_ORIGIN}/`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    // Try local development
    try {
      const response = await fetch(`${TRUSTVAULT_LOCAL}/`, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Get credentials for specific origin from TrustVault
 *
 * Secrets are never persisted in extension storage: the vault lives
 * encrypted inside the PWA, and chrome.storage.local is plaintext at rest.
 * Until a secure transport from the PWA exists (e.g. authenticated
 * externally_connectable messaging that returns per-origin entries on
 * demand), this returns no credentials and the fill path stays inert.
 */
async function getCredentialsForOrigin(_origin) {
  return [];
}

/**
 * Remove plaintext credentials persisted by earlier versions
 */
function purgeLegacyCredentialStore() {
  chrome.storage.local.remove('credentials');
}

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CREDENTIALS') {
    getCredentialsForOrigin(request.origin)
      .then(credentials => {
        sendResponse({ success: true, credentials });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.type === 'OPEN_TRUSTVAULT') {
    chrome.tabs.create({ url: TRUSTVAULT_ORIGIN });
    sendResponse({ success: true });
    return false;
  }

  if (request.type === 'CHECK_ACCESSIBILITY') {
    isTrustVaultAccessible()
      .then(accessible => {
        sendResponse({ accessible });
      });
    return true;
  }
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
  // Open TrustVault PWA in new tab
  chrome.tabs.create({ url: TRUSTVAULT_ORIGIN });
});

/**
 * Initialize extension
 */
chrome.runtime.onInstalled.addListener((details) => {
  purgeLegacyCredentialStore();

  if (details.reason === 'install') {
    console.log('TrustVault Autofill installed');

    // Set up default settings
    chrome.storage.local.set({
      settings: {
        enabled: false,
        autoSubmit: false,
        requireConfirmation: true,
      },
    });

    // Open welcome page
    chrome.tabs.create({ url: TRUSTVAULT_ORIGIN });
  }
});

console.log('TrustVault Autofill background service worker loaded');
