/**
 * Builds the password-strength explanation prompt and runs it.
 * SECURITY: the prompt is constructed ONLY from the strength label and a
 * rounded entropy integer — never a password, username, origin, or any secret.
 */
import type { StrengthExplainInput } from './aiTypes';
import { runPrompt } from './promptApi';

export const STRENGTH_SYSTEM_PROMPT =
  'You are a security assistant. Explain password strength in 2-3 simple sentences. ' +
  'Never ask for or guess the actual password.';

export function buildStrengthPrompt(input: StrengthExplainInput): string {
  const entropy = Math.round(input.entropyBits);
  return (
    `The password strength is "${input.strength}" with an estimated entropy of ${entropy} bits. ` +
    'Explain why this rating is appropriate and give one tip, ' +
    'without guessing or revealing any password.'
  );
}

export async function explainStrength(
  input: StrengthExplainInput,
  signal?: AbortSignal,
): Promise<string> {
  return runPrompt({
    systemPrompt: STRENGTH_SYSTEM_PROMPT,
    userPrompt: buildStrengthPrompt(input),
    ...(signal ? { signal } : {}),
  });
}
