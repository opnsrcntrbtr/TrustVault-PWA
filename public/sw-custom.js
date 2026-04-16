/**
 * Custom Service Worker Code
 * Injected into the generated Workbox service worker
 * Handles version management and SKIP_WAITING messages
 */

// Version constant - updated on each build
const VERSION = '__APP_VERSION__'; // Will be replaced by build process

console.log(`[SW] TrustVault Service Worker ${VERSION} initializing...`);

// Listen for messages from the client
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);

  // Handle version request
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: VERSION,
    });
  }

  // Handle skip waiting request (user clicked "Update Now")
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING message received, activating new service worker');
    self.skipWaiting();
  }
});

// Log when service worker is installed
self.addEventListener('install', (event) => {
  console.log(`[SW] Service worker ${VERSION} installed`);
});

// Log when service worker is activated
self.addEventListener('activate', (event) => {
  console.log(`[SW] Service worker ${VERSION} activated`);
  // Claim all clients immediately after activation
  event.waitUntil(self.clients.claim());
});
