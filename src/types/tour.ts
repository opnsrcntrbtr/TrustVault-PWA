/**
 * TrustVault Onboarding Tour Types
 * Type definitions for driver.js tour configuration
 */

import type { DriveStep, Config } from 'driver.js';

/**
 * Tour step configuration
 */
export interface TourStep extends DriveStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

/**
 * Tour configuration
 */
export interface TourConfig extends Partial<Config> {
  showProgress?: boolean;
  animate?: boolean;
  overlayOpacity?: number;
  popoverClass?: string;
  steps: TourStep[];
  onDestroyed?: () => void;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
}

/**
 * Tour types for different onboarding flows
 */
export type TourType =
  | 'first-time'           // Full onboarding for new users
  | 'dashboard'            // Dashboard features tour
  | 'security'             // Security features walkthrough
  | 'credentials'          // Credential management tour
  | 'export'               // Export functionality guide
  | 'biometric'            // Biometric authentication setup
  | 'pwa-install';         // PWA installation guide

/**
 * Tour state in localStorage
 */
export interface TourState {
  completed: boolean;
  completedAt?: string;
  version: string;
  tours: Record<TourType, boolean>;
}

/**
 * Tour analytics event
 */
export interface TourEvent {
  type: 'started' | 'completed' | 'skipped' | 'step_changed';
  tourType: TourType;
  step?: number;
  totalSteps?: number;
  timestamp: string;
}
