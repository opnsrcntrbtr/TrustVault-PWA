/**
 * TrustVault Autofill - Vault Bridge Content Script
 *
 * Runs only on TrustVault PWA origins (see manifest.json). Relays a
 * credential request from the background service worker to the PWA page
 * (main world) via postMessage, and relays the PWA's response back.
 *
 * No credential data is ever stored by the extension - this is a stateless
 * pass-through for the lifetime of a single request, and the PWA itself
 * decides whether to answer (vault must be unlocked and the origin must be
 * autofill-enabled).
 */

const BRIDGE_REQUEST = 'TRUSTVAULT_EXTENSION_REQUEST_CREDENTIALS';
const BRIDGE_RESPONSE = 'TRUSTVAULT_EXTENSION_CREDENTIALS_RESPONSE';
const BRIDGE_TIMEOUT_MS = 1000;

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type !== 'REQUEST_CREDENTIALS_FROM_PWA') {
    return undefined;
  }

  const requestId = crypto.randomUUID();
  let responded = false;

  const finish = (credentials) => {
    if (responded) return;
    responded = true;
    window.removeEventListener('message', handleResponse);
    sendResponse({ success: true, credentials });
  };

  function handleResponse(event) {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    const data = event.data;
    if (!data || data.type !== BRIDGE_RESPONSE || data.requestId !== requestId) {
      return;
    }
    finish(Array.isArray(data.credentials) ? data.credentials : []);
  }

  window.addEventListener('message', handleResponse);

  // Vault locked / PWA not loaded / no listener - resolve empty so the
  // content script doesn't hang.
  setTimeout(() => finish([]), BRIDGE_TIMEOUT_MS);

  window.postMessage(
    { type: BRIDGE_REQUEST, requestId, origin: request.origin },
    window.location.origin
  );

  return true; // respond asynchronously
});
