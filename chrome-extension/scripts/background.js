/**
 * TrustVault Autofill - Background Service Worker
 * Coordinates explicit, short-lived credential requests between content scripts
 * and the unlocked TrustVault PWA. Credentials are never written to extension storage.
 */

const TRUSTVAULT_ORIGINS = [
  'https://trust-vault-pwa.vercel.app',
  'http://localhost:3000',
];
const REQUEST_TTL_MS = 60_000;
const pendingRequests = new Map();

function getTrustVaultOrigin() {
  return TRUSTVAULT_ORIGINS[0];
}

function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function cleanupExpiredRequests() {
  const now = Date.now();
  for (const [nonce, request] of pendingRequests.entries()) {
    if (now >= request.expiresAt) {
      pendingRequests.delete(nonce);
    }
  }
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['scripts/content.js'],
  });
}

async function startCredentialRequest(tab) {
  if (!tab?.id || !tab.url) {
    throw new Error('No active tab available');
  }

  const tabOrigin = getOrigin(tab.url);
  if (!tabOrigin || tabOrigin.startsWith('chrome://')) {
    throw new Error('Autofill is not available on this page');
  }

  const nonce = createNonce();
  pendingRequests.set(nonce, {
    tabId: tab.id,
    tabOrigin,
    expiresAt: Date.now() + REQUEST_TTL_MS,
  });

  await injectContentScript(tab.id);
  await chrome.tabs.sendMessage(tab.id, {
    type: 'TRUSTVAULT_REQUEST_STARTED',
    nonce,
    tabOrigin,
    expiresAt: Date.now() + REQUEST_TTL_MS,
  });

  const bridgeUrl = `${getTrustVaultOrigin()}/?extensionRequest=${encodeURIComponent(nonce)}&origin=${encodeURIComponent(tabOrigin)}&extensionId=${encodeURIComponent(chrome.runtime.id)}`;
  await chrome.tabs.create({ url: bridgeUrl, active: true });

  return { nonce, tabOrigin };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_CREDENTIAL_REQUEST') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => startCredentialRequest(tab))
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'OPEN_TRUSTVAULT') {
    chrome.tabs.create({ url: getTrustVaultOrigin() });
    sendResponse({ success: true });
    return false;
  }

  if (request.type === 'CHECK_ACCESSIBILITY') {
    fetch(`${getTrustVaultOrigin()}/`, { method: 'HEAD' })
      .then((response) => sendResponse({ accessible: response.ok }))
      .catch(() => sendResponse({ accessible: false }));
    return true;
  }

  if (request.type === 'GET_REQUEST_STATUS') {
    cleanupExpiredRequests();
    const nonce = typeof request.nonce === 'string' ? request.nonce : '';
    sendResponse({ active: pendingRequests.has(nonce) });
    return false;
  }

  return false;
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  cleanupExpiredRequests();

  if (!TRUSTVAULT_ORIGINS.includes(sender.origin || '')) {
    sendResponse({ success: false, error: 'Untrusted origin' });
    return false;
  }

  if (request.type !== 'TRUSTVAULT_CREDENTIAL_RESPONSE') {
    return false;
  }

  const nonce = typeof request.nonce === 'string' ? request.nonce : '';
  const pending = pendingRequests.get(nonce);
  if (!pending) {
    sendResponse({ success: false, error: 'Unknown or expired request' });
    return false;
  }

  const credentials = Array.isArray(request.credentials) ? request.credentials : [];
  const scopedCredentials = credentials.filter((credential) => {
    const credentialOrigin = getOrigin(credential?.url);
    return credentialOrigin === pending.tabOrigin;
  });

  chrome.tabs.sendMessage(pending.tabId, {
    type: 'TRUSTVAULT_CREDENTIALS_AVAILABLE',
    nonce,
    credentials: scopedCredentials,
  });

  pendingRequests.delete(nonce);
  sendResponse({ success: true, delivered: scopedCredentials.length });
  return false;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      settings: {
        enabled: true,
        autoSubmit: false,
        requireConfirmation: true,
      },
    });
    chrome.tabs.create({ url: getTrustVaultOrigin() });
  }
});
