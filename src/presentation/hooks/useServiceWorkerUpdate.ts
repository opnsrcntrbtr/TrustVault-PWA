/**
 * Service Worker Update Hook
 * Handles PWA update detection and installation across all platforms
 *
 * Features:
 * - Automatic update detection when new SW enters "waiting" state
 * - Manual update check via button/menu
 * - Cross-platform support (Android WebAPK, iOS standalone, Desktop PWA)
 * - skipWaiting() pattern with postMessage communication
 * - Session storage to preserve state across reload
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServiceWorkerUpdateState {
  // Update availability
  updateAvailable: boolean;
  updateChecking: boolean;
  updateInstalling: boolean;

  // Version information
  currentVersion: string | null;
  availableVersion: string | null;

  // Actions
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;

  // Error handling
  error: string | null;
}

const SW_UPDATE_DISMISSED_KEY = 'sw-update-dismissed';
const SW_UPDATE_AVAILABLE_KEY = 'sw-update-available';

/**
 * Custom hook for managing service worker updates
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  /**
   * Get current service worker version from active worker
   */
  const fetchCurrentVersion = useCallback(async () => {
    if (!navigator.serviceWorker.controller) {
      return null;
    }

    try {
      // Query the active service worker for its version
      const messageChannel = new MessageChannel();

      return new Promise<string | null>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'VERSION') {
            resolve(event.data.version);
          } else {
            resolve(null);
          }
        };

        navigator.serviceWorker.controller?.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );

        // Timeout after 2 seconds
        setTimeout(() => { resolve(null); }, 2000);
      });
    } catch (err) {
      console.error('Failed to fetch current version:', err);
      return null;
    }
  }, []);

  /**
   * Get version from waiting service worker
   */
  const fetchWaitingVersion = useCallback(async (worker: ServiceWorker) => {
    try {
      const messageChannel = new MessageChannel();

      return new Promise<string | null>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'VERSION') {
            resolve(event.data.version);
          } else {
            resolve(null);
          }
        };

        worker.postMessage(
          { type: 'GET_VERSION' },
          [messageChannel.port2]
        );

        // Timeout after 2 seconds
        setTimeout(() => { resolve(null); }, 2000);
      });
    } catch (err) {
      console.error('Failed to fetch waiting version:', err);
      return null;
    }
  }, []);

  /**
   * Handle update found (new service worker waiting)
   */
  const handleUpdateFound = useCallback(async (registration: ServiceWorkerRegistration) => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker) return;

    console.log('Service worker update found');

    waitingWorkerRef.current = waitingWorker;
    registrationRef.current = registration;

    // Check if user previously dismissed this update
    const dismissed = sessionStorage.getItem(SW_UPDATE_DISMISSED_KEY);
    if (dismissed === waitingWorker.scriptURL) {
      console.log('User dismissed this update, not showing notification');
      return;
    }

    // Fetch versions
    const [current, available] = await Promise.all([
      fetchCurrentVersion(),
      fetchWaitingVersion(waitingWorker)
    ]);

    setCurrentVersion(current);
    setAvailableVersion(available);
    setUpdateAvailable(true);

    // Store in session for persistence
    sessionStorage.setItem(SW_UPDATE_AVAILABLE_KEY, 'true');
  }, [fetchCurrentVersion, fetchWaitingVersion]);

  /**
   * Check for service worker updates manually
   */
  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setError('Service workers are not supported in this browser');
      return;
    }

    setUpdateChecking(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        setError('No service worker registered');
        setUpdateChecking(false);
        return;
      }

      console.log('Checking for service worker updates...');

      // Trigger update check
      await registration.update();

      // Wait a bit for the update to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if there's a waiting worker
      if (registration.waiting) {
        await handleUpdateFound(registration);
      } else if (!registration.installing) {
        // No update available
        console.log('No service worker update available');
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setError('Failed to check for updates. Please try again.');
    } finally {
      setUpdateChecking(false);
    }
  }, [handleUpdateFound]);

  /**
   * Install the waiting service worker update
   */
  const installUpdate = useCallback(async () => {
    const waitingWorker = waitingWorkerRef.current;

    if (!waitingWorker) {
      setError('No update available to install');
      return;
    }

    setUpdateInstalling(true);
    setError(null);

    try {
      // Clear dismissed flag
      sessionStorage.removeItem(SW_UPDATE_DISMISSED_KEY);

      // Set flag to show success message after reload
      sessionStorage.setItem('sw-update-completed', 'true');

      // Send SKIP_WAITING message to the waiting worker
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Listen for controllerchange event
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('New service worker activated, reloading page...');
        // Reload the page to use the new service worker
        window.location.reload();
      }, { once: true });

    } catch (err) {
      console.error('Failed to install update:', err);
      setError('Failed to install update. Please try again.');
      setUpdateInstalling(false);
    }
  }, []);

  /**
   * Dismiss the update notification (user can update later)
   */
  const dismissUpdate = useCallback(() => {
    const waitingWorker = waitingWorkerRef.current;

    if (waitingWorker) {
      // Store dismissal in session storage
      sessionStorage.setItem(SW_UPDATE_DISMISSED_KEY, waitingWorker.scriptURL);
    }

    sessionStorage.removeItem(SW_UPDATE_AVAILABLE_KEY);
    setUpdateAvailable(false);
    console.log('Update notification dismissed');
  }, []);

  /**
   * Setup service worker update listeners
   */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const setupListeners = async (): Promise<void> => {
      try {
        registration = await navigator.serviceWorker.getRegistration() ?? null;

        if (!registration) {
          console.log('No service worker registration found');
          return;
        }

        registrationRef.current = registration;

        // Fetch current version
        const version = await fetchCurrentVersion();
        setCurrentVersion(version);

        // Check if there's already a waiting worker
        if (registration.waiting) {
          await handleUpdateFound(registration);
        }

        // Listen for new service worker installing
        registration.addEventListener('updatefound', () => {
          if (!registration) return;
          const installingWorker = registration.installing;

          if (!installingWorker) return;

          console.log('New service worker installing...');

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller && registration) {
              // New service worker installed and waiting
              void handleUpdateFound(registration);
            }
          });
        });

        // Check on interval (every 60 seconds) - only in production
        if (import.meta.env.PROD) {
          intervalId = setInterval(() => {
            registration?.update().catch(console.error);
          }, 60000); // Check every minute
        }
      } catch (err) {
        console.error('Failed to setup service worker listeners:', err);
      }
    };

    void setupListeners();

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchCurrentVersion, handleUpdateFound]);

  /**
   * Check session storage on mount for persisted update state
   */
  useEffect(() => {
    const wasUpdateAvailable = sessionStorage.getItem(SW_UPDATE_AVAILABLE_KEY);
    if (wasUpdateAvailable === 'true') {
      // Re-check for update
      checkForUpdate();
    }
  }, [checkForUpdate]);

  return {
    updateAvailable,
    updateChecking,
    updateInstalling,
    currentVersion,
    availableVersion,
    checkForUpdate,
    installUpdate,
    dismissUpdate,
    error,
  };
}
