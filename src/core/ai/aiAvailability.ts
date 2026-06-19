/**
 * Chrome built-in AI availability detection.
 * NEVER calls create(); only reads the static availability() state.
 */
import type { AiAvailability } from './aiTypes';

interface LanguageModelStatic {
  availability(): Promise<AiAvailability>;
}

function getLanguageModel(): LanguageModelStatic | undefined {
  const lm = (globalThis as Record<string, unknown>).LanguageModel;
  if (lm && typeof (lm as LanguageModelStatic).availability === 'function') {
    return lm as LanguageModelStatic;
  }
  return undefined;
}

export async function getAiAvailability(): Promise<AiAvailability> {
  const lm = getLanguageModel();
  if (!lm) return 'unavailable';
  try {
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

/** Feature may run only when the model is already present — never triggers a download. */
export function isFeatureUsable(availability: AiAvailability): boolean {
  return availability === 'available';
}
