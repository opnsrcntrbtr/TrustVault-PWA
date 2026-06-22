/**
 * Builds the breach impact explanation prompt and runs it.
 * SECURITY: the prompt is constructed from public breach metadata and safe credential metadata.
 * Passwords and secret notes MUST NEVER be passed into this module.
 */
import type { BreachData } from '@/core/breach/breachTypes';
import { runPromptStreaming } from './promptApi';
import { assertNoSecrets } from '@/core/ai/chat/chatContext';

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
