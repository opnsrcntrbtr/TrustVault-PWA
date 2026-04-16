/**
 * OnboardingTour Component
 * Wrapper component for driver.js tour integration
 */

import { useEffect } from 'react';
import { useDriverTour } from '@/hooks/useDriverTour';
import 'driver.js/dist/driver.css';

interface OnboardingTourProps {
  /**
   * Auto-start tour for first-time users
   */
  autoStart?: boolean;

  /**
   * Delay before auto-starting tour (ms)
   */
  delay?: number;

  /**
   * Callback when tour completes
   */
  onComplete?: () => void;
}

/**
 * OnboardingTour Component
 * Automatically starts first-time tour for new users
 */
export default function OnboardingTour({
  autoStart = true,
  delay = 1000,
  onComplete,
}: OnboardingTourProps) {
  const { startFirstTimeTour, isFirstTimeUser } = useDriverTour();

  useEffect(() => {
    if (autoStart && isFirstTimeUser) {
      // Delay tour start to allow page to fully render
      const timeout = setTimeout(() => {
        startFirstTimeTour();

        if (onComplete) {
          onComplete();
        }
      }, delay);

      return () => {
        clearTimeout(timeout);
      };
    }

    return () => {};
  }, [autoStart, delay, isFirstTimeUser, startFirstTimeTour, onComplete]);

  // This component doesn't render anything visible
  return null;
}
