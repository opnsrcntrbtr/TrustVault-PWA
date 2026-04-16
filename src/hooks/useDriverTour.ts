/**
 * useDriverTour Hook
 * Provides driver.js tour functionality with localStorage persistence
 */

import { useCallback, useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import type { TourType, TourConfig, TourState } from '@/types/tour';

const TOUR_STORAGE_KEY = 'trustvault_tour_state';
const TOUR_VERSION = '1.0.0';

/**
 * Get tour state from localStorage
 */
function getTourState(): TourState {
  try {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as TourState;
    }
  } catch (error) {
    console.error('Failed to load tour state:', error);
  }

  return {
    completed: false,
    version: TOUR_VERSION,
    tours: {
      'first-time': false,
      'dashboard': false,
      'security': false,
      'credentials': false,
      'export': false,
      'biometric': false,
      'pwa-install': false,
    },
  };
}

/**
 * Save tour state to localStorage
 */
function saveTourState(state: TourState): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save tour state:', error);
  }
}

/**
 * Mark specific tour as completed
 */
function markTourCompleted(tourType: TourType): void {
  const state = getTourState();
  state.tours[tourType] = true;

  // Mark overall tour as completed if first-time tour is done
  if (tourType === 'first-time') {
    state.completed = true;
    state.completedAt = new Date().toISOString();
  }

  saveTourState(state);
}

/**
 * Check if user is a first-time visitor
 */
export function isFirstTimeUser(): boolean {
  const state = getTourState();
  return !state.completed;
}

/**
 * Check if specific tour has been completed
 */
export function isTourCompleted(tourType: TourType): boolean {
  const state = getTourState();
  return state.tours[tourType] || false;
}

/**
 * Reset tour state (for testing or re-onboarding)
 */
export function resetTourState(): void {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

/**
 * useDriverTour Hook
 */
export function useDriverTour() {
  const driverRef = useRef<Driver | null>(null);

  /**
   * Initialize driver instance
   */
  const initializeDriver = useCallback((config: TourConfig, tourType: TourType) => {
    // Destroy existing instance if any
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    // Create new driver instance with proper overlay configuration
    driverRef.current = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.5,
      stagePadding: 10,
      stageRadius: 8,
      popoverClass: 'trustvault-tour',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Get Started',
      allowClose: true,
      smoothScroll: true,
      disableActiveInteraction: false,
      ...config,
      onDestroyStarted: (element, step, options) => {
        // Save completion state before destruction starts
        markTourCompleted(tourType);

        // Call custom onDestroyStarted if provided
        if (config.onDestroyStarted) {
          config.onDestroyStarted(element, step, options);
        }

        // Properly destroy the driver
        if (driverRef.current) {
          driverRef.current.destroy();
        }
      },
      onDestroyed: () => {
        // Clear the driver reference after destruction
        driverRef.current = null;

        // Call custom onDestroyed if provided
        if (config.onDestroyed) {
          config.onDestroyed();
        }
      },
    });

    return driverRef.current;
  }, []);

  /**
   * Start first-time onboarding tour
   */
  const startFirstTimeTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: 'body',
          popover: {
            title: '👋 Welcome to TrustVault',
            description: `Your enterprise-grade, security-first credential manager. Let's take a quick tour of the key features to help you get started securely.`,
            side: 'top',
          },
        },
        {
          element: '[data-tour="dashboard"]',
          popover: {
            title: '🏠 Dashboard',
            description: 'Your secure vault dashboard. All your credentials are encrypted with AES-256-GCM and stored locally on your device. No cloud, no servers, complete privacy.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="add-credential"]',
          popover: {
            title: '➕ Add Credentials',
            description: 'Click here to add new login credentials, credit cards, secure notes, or other sensitive information. Each entry is encrypted with your master password.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="search"]',
          popover: {
            title: '🔍 Search & Filter',
            description: 'Quickly find your credentials using search. You can also filter by category, tags, or favorites for fast access.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="security-audit"]',
          popover: {
            title: '🛡️ Security Audit',
            description: 'Monitor your security health. Check for breached passwords, weak credentials, and get recommendations to improve your vault security.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="settings"]',
          popover: {
            title: '⚙️ Settings',
            description: 'Configure backup options, enable biometric authentication, manage your vault, and customize security preferences.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="offline-indicator"]',
          popover: {
            title: '📡 Offline Mode',
            description: 'TrustVault works completely offline. Your data is stored locally and never leaves your device. No internet connection required.',
            side: 'left',
          },
        },
        {
          element: 'body',
          popover: {
            title: '🎉 You\'re All Set!',
            description: `Start securing your credentials with TrustVault. Remember: Your master password is the key to your vault - keep it safe and never share it with anyone.`,
            side: 'top',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'first-time');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start dashboard features tour
   */
  const startDashboardTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: '[data-tour="credential-list"]',
          popover: {
            title: '📋 Your Credentials',
            description: 'All your saved credentials appear here. Click on any card to view details, copy passwords, or edit information.',
            side: 'top',
          },
        },
        {
          element: '[data-tour="favorite-button"]',
          popover: {
            title: '⭐ Favorites',
            description: 'Mark frequently used credentials as favorites for quick access. Use the star icon on any credential card.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="category-filter"]',
          popover: {
            title: '🗂️ Categories',
            description: 'Filter credentials by category: Logins, Credit Cards, Bank Accounts, Secure Notes, and more.',
            side: 'bottom',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'dashboard');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start security features tour
   */
  const startSecurityTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: '[data-tour="breach-scanner"]',
          popover: {
            title: '🔒 Breach Detection',
            description: 'Check if your passwords have been exposed in data breaches using the Have I Been Pwned API with k-anonymity for privacy.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="password-strength"]',
          popover: {
            title: '💪 Password Strength',
            description: 'View password strength analysis and get suggestions for creating stronger, more secure passwords.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="biometric-auth"]',
          popover: {
            title: '👆 Biometric Authentication',
            description: 'Enable fingerprint or face recognition for quick and secure access to your vault using WebAuthn.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="backup-options"]',
          popover: {
            title: '💾 Backup & Export',
            description: 'Export your encrypted vault for backup. Always keep a secure backup in case you need to restore your data.',
            side: 'left',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'security');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start credential management tour
   */
  const startCredentialsTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: '[data-tour="credential-form"]',
          popover: {
            title: '📝 Add New Credential',
            description: 'Fill in your credential details. All fields are encrypted before storage.',
            side: 'top',
          },
        },
        {
          element: '[data-tour="password-generator"]',
          popover: {
            title: '🎲 Password Generator',
            description: 'Generate strong, random passwords with customizable length and character types.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="totp-field"]',
          popover: {
            title: '🔐 2FA Support',
            description: 'Store TOTP secrets for two-factor authentication. View live OTP codes directly in TrustVault.',
            side: 'bottom',
          },
        },
        {
          element: '[data-tour="tags-input"]',
          popover: {
            title: '🏷️ Tags',
            description: 'Organize credentials with custom tags for easy filtering and search.',
            side: 'bottom',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'credentials');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start export functionality tour
   */
  const startExportTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: '[data-tour="export-button"]',
          popover: {
            title: '📤 Export Vault',
            description: 'Export your vault data in encrypted or plain JSON format for backup or migration.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="export-options"]',
          popover: {
            title: '🔒 Export Security',
            description: 'Choose encrypted export to protect your data with a password. Never share unencrypted exports.',
            side: 'bottom',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'export');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start PWA installation tour
   */
  const startPWAInstallTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: 'body',
          popover: {
            title: '📱 Install TrustVault',
            description: 'TrustVault is a Progressive Web App (PWA). You can install it on your device for a native app experience.',
            side: 'top',
          },
        },
        {
          element: '[data-tour="install-button"]',
          popover: {
            title: '⬇️ Install Now',
            description: 'Click here to install TrustVault. It will work offline and appear on your home screen like a native app.',
            side: 'bottom',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'pwa-install');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Start biometric setup tour
   */
  const startBiometricTour = useCallback(() => {
    const config: TourConfig = {
      steps: [
        {
          element: '[data-tour="biometric-toggle"]',
          popover: {
            title: '👆 Enable Biometrics',
            description: 'Use your fingerprint or face recognition to unlock your vault quickly and securely.',
            side: 'left',
          },
        },
        {
          element: '[data-tour="biometric-setup"]',
          popover: {
            title: '🔐 Secure Setup',
            description: 'Your biometric data never leaves your device. It\'s stored in your device\'s secure enclave using WebAuthn.',
            side: 'bottom',
          },
        },
      ],
    };

    const driverInstance = initializeDriver(config, 'biometric');
    driverInstance.drive();
  }, [initializeDriver]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return {
    startFirstTimeTour,
    startDashboardTour,
    startSecurityTour,
    startCredentialsTour,
    startExportTour,
    startPWAInstallTour,
    startBiometricTour,
    isFirstTimeUser: isFirstTimeUser(),
    isTourCompleted,
    resetTourState,
  };
}
