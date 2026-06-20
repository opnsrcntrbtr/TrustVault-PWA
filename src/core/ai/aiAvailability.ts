/**
 * Availability facade. Reports the chrome-builtin provider's raw state when it
 * has anything to say (preserves the 'downloadable'/'downloading' nuance Settings
 * displays); otherwise falls back to whichever provider the registry selects
 * (e.g. WebLLM on Android), so hooks and Settings keep their current
 * `getAiAvailability()` / `isFeatureUsable()` API.
 */
import type { AiAvailability } from '@/core/ai/aiTypes';
import { getActiveProvider } from '@/core/ai/providers/registry';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';

export async function getAiAvailability(): Promise<AiAvailability> {
  const chromeAvail = await chromeBuiltinProvider.getAvailability();
  if (chromeAvail !== 'unavailable') return chromeAvail;

  const provider = await getActiveProvider();
  if (!provider) return 'unavailable';
  return provider.getAvailability();
}

/** Feature may run only when the active provider is fully ready. */
export function isFeatureUsable(availability: AiAvailability): boolean {
  return availability === 'available';
}
