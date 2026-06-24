/**
 * Builds the password-strength explanation prompt and runs it.
 * SECURITY: the prompt is constructed ONLY from the strength label and a
 * rounded entropy integer — never a password, username, origin, or any secret.
 */
import type { StrengthExplainInput } from './aiTypes';
import { runPrompt, runStructured } from './promptApi';

export const STRENGTH_SYSTEM_PROMPT =
  'You are a security assistant. Explain password strength in 2-3 simple sentences. ' +
  'Never ask for or guess the actual password.';

export function buildStrengthPrompt(input: StrengthExplainInput): string {
  const entropy = Math.round(input.entropyBits);
  return (
    `The password strength is "${input.strength}" with an estimated entropy of ${String(entropy)} bits. ` +
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

export interface StrengthInsight {
  severity: 'low' | 'medium' | 'high';
  factors: string[];
  rankedActions: string[];
}

export const STRENGTH_INSIGHT_SCHEMA = {
  type: 'object',
  required: ['severity', 'factors', 'rankedActions'],
  additionalProperties: false,
  properties: {
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    factors: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    rankedActions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
  },
} as const;

export function parseStrengthInsight(raw: string): StrengthInsight | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (v.severity !== 'low' && v.severity !== 'medium' && v.severity !== 'high') return null;
    if (!Array.isArray(v.factors) || !Array.isArray(v.rankedActions)) return null;
    const factors = v.factors.filter((x): x is string => typeof x === 'string');
    const rankedActions = v.rankedActions.filter((x): x is string => typeof x === 'string');
    return { severity: v.severity, factors, rankedActions };
  } catch {
    return null;
  }
}

export async function explainStrengthStructured(
  input: StrengthExplainInput,
  signal?: AbortSignal,
): Promise<{ insight: StrengthInsight } | { raw: string }> {
  const raw = await runStructured({
    systemPrompt: STRENGTH_SYSTEM_PROMPT,
    userPrompt: buildStrengthPrompt(input),
    schema: STRENGTH_INSIGHT_SCHEMA,
    params: { temperature: 0.3, topK: 3 },
    ...(signal ? { signal } : {}),
  });
  const insight = parseStrengthInsight(raw);
  return insight ? { insight } : { raw };
}
