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
 */
async function getCredentialsForOrigin(origin) {
  try {
    // In production, this would communicate with TrustVault PWA
    // via chrome.runtime.sendMessage to a TrustVault extension component
    // or use cross-origin messaging with proper security

    // For now, return stored credentials from extension storage
    const result = await chrome.storage.local.get('credentials');
    const allCredentials = result.credentials || [];

    // Filter by origin
    return allCredentials.filter(cred => {
      if (!cred.url) return false;

      try {
        const credUrl = new URL(cred.url);
        return credUrl.origin === origin;
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return [];
  }
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

  if (request.type === 'STORE_CREDENTIAL') {
    chrome.storage.local.get('credentials', (result) => {
      const credentials = result.credentials || [];
      credentials.push(request.credential);

      chrome.storage.local.set({ credentials }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
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
  if (details.reason === 'install') {
    console.log('TrustVault Autofill installed');

    // Set up default settings
    chrome.storage.local.set({
      settings: {
        enabled: false,
        autoSubmit: false,
        requireConfirmation: true,
      },
      credentials: [],
    });

    // Open welcome page
    chrome.tabs.create({ url: TRUSTVAULT_ORIGIN });
  }
});

console.log('TrustVault Autofill background service worker loaded');
