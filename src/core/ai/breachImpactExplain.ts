/**
 * Builds the breach impact explanation prompt and runs it.
 * SECURITY: the prompt is constructed from public breach metadata and safe credential metadata.
 * Passwords and secret notes MUST NEVER be passed into this module.
 */
import type { BreachData } from '@/core/breach/breachTypes';
import { runPromptStreaming, runStructured } from './promptApi';
import { assertNoSecrets } from '@/core/ai/chat/chatContext';
import { resolveAiLanguage } from './aiLanguages';

export interface BreachImpactExplainInput {
  breaches: BreachData[];
  credentialTitle: string;
  credentialUsername?: string | undefined;
  credentialCategory?: string | undefined;
  credentialAgeDays?: number | undefined;
}

export const BREACH_SYSTEM_PROMPT =
  'You are a security assistant for a zero-knowledge password manager. ' +
  'Explain the impact of the following data breaches on the user\'s credential. ' +
  'Provide a 2-3 sentence summary of the risks, followed by 2-3 bullet points of specific, actionable remediation advice. ' +
  'Never ask for or guess the actual password. Keep the tone calm, helpful, and professional. Format the output with clear bullet points where appropriate.';

export function buildBreachPrompt(input: BreachImpactExplainInput): string {
  let prompt = `Analyze the impact of these data breaches for a credential.\n\n`;
  
  prompt += `Credential Context:\n`;
  prompt += `- Title: ${input.credentialTitle}\n`;
  if (input.credentialUsername) {
    prompt += `- Username: ${input.credentialUsername}\n`;
  }
  if (input.credentialCategory) {
    prompt += `- Category: ${input.credentialCategory}\n`;
  }
  if (input.credentialAgeDays !== undefined) {
    prompt += `- Password age: ${String(Math.round(input.credentialAgeDays))} days\n`;
  }

  prompt += `\nAssociated Breaches:\n`;
  for (const breach of input.breaches) {
    prompt += `- Breach Name: ${breach.title}\n`;
    if (breach.breachDate) {
      prompt += `  - Date: ${breach.breachDate}\n`;
    }
    if (breach.dataClasses.length > 0) {
      prompt += `  - Compromised data: ${breach.dataClasses.join(', ')}\n`;
    }
  }

  prompt += `\nPlease explain the specific risks for this type of credential based on the compromised data, and list actionable remediation steps.`;

  assertNoSecrets(prompt);
  return prompt;
}

export function explainBreachImpact(
  input: BreachImpactExplainInput,
  signal?: AbortSignal,
): AsyncIterableIterator<string> {
  return runPromptStreaming({
    systemPrompt: BREACH_SYSTEM_PROMPT,
    userPrompt: buildBreachPrompt(input),
    ...(signal ? { signal } : {}),
  });
}

export interface BreachInsight {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  exposedData: string[];
  steps: string[];
}

export const BREACH_INSIGHT_SCHEMA = {
  type: 'object',
  required: ['riskLevel', 'exposedData', 'steps'],
  additionalProperties: false,
  properties: {
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    exposedData: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    steps: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
} as const;

const BREACH_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export function parseBreachInsight(raw: string): BreachInsight | null {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.riskLevel !== 'string' || !BREACH_RISK_LEVELS.includes(v.riskLevel)) return null;
    if (!Array.isArray(v.exposedData) || !Array.isArray(v.steps)) return null;
    return {
      riskLevel: v.riskLevel as BreachInsight['riskLevel'],
      exposedData: v.exposedData.filter((x): x is string => typeof x === 'string'),
      steps: v.steps.filter((x): x is string => typeof x === 'string'),
    };
  } catch {
    return null;
  }
}

export async function explainBreachImpactStructured(
  input: BreachImpactExplainInput,
  signal?: AbortSignal,
): Promise<{ insight: BreachInsight } | { raw: string }> {
  const raw = await runStructured({
    systemPrompt: BREACH_SYSTEM_PROMPT,
    userPrompt: buildBreachPrompt(input),
    schema: BREACH_INSIGHT_SCHEMA,
    params: { temperature: 0.3, topK: 3 },
    languages: { expectedInputLanguages: ['en'], outputLanguage: resolveAiLanguage(navigator.language) },
    ...(signal ? { signal } : {}),
  });
  const insight = parseBreachInsight(raw);
  return insight ? { insight } : { raw };
}
