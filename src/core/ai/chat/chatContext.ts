/**
 * Single chokepoint for every APP-CONSTRUCTED chat prompt.
 * SECURITY: passwords / secret notes / keys MUST NEVER reach here. All output
 * is run through assertNoSecrets(). Free-text USER turns are NOT inspected and
 * never pass through this module.
 */
import type { ChatScope, CredentialSafeMeta, VaultSafeAggregate } from '@/core/ai/chat/chatTypes';

const SECRET_FIELD_PATTERN = /(?:password|notes)\s*:/i;

export function assertNoSecrets(text: string): void {
  if (SECRET_FIELD_PATTERN.test(text)) {
    throw new Error('Safety invariant violation: context contains potential secret fields.');
  }
}

export const GENERAL_ASSISTANT_SYSTEM_PROMPT_BASE =
  'You are a security assistant for TrustVault, a zero-knowledge password manager. ' +
  'All of your inference runs entirely on this device — nothing you read or generate is ever sent to a server. ' +
  'If asked whether messages are transmitted, stored remotely, or covered by a privacy policy, ' +
  'state clearly that everything runs locally and nothing leaves the device. ' +
  'Answer the user\'s security and password questions clearly and concisely. ' +
  'Never ask for or guess any actual password, secret, or private key.';

function curatedBlock(agg: VaultSafeAggregate): string {
  const cats = Object.entries(agg.categories).map(([k, v]) => `${k}=${String(v)}`).join(', ');
  let block = `\n\nNon-secret summary of the user's vault (no passwords or secrets):\n`;
  block += `- Total credentials: ${String(agg.total)}\n`;
  block += `- weak: ${String(agg.weak)}, reused: ${String(agg.reused)}, breached: ${String(agg.breached)}\n`;
  if (cats) block += `- Categories: ${cats}\n`;
  if (agg.oldestPasswordAgeDays !== undefined) {
    block += `- Oldest password age: ${String(Math.round(agg.oldestPasswordAgeDays))} days\n`;
  }
  return block;
}

function credentialBlock(c: CredentialSafeMeta): string {
  let block = `\n\nThe user is asking about one credential (no password or secret):\n`;
  block += `- Title: ${c.title}\n`;
  if (c.username) block += `- Username: ${c.username}\n`;
  if (c.category) block += `- Category: ${c.category}\n`;
  if (c.ageDays !== undefined) block += `- Password age: ${String(Math.round(c.ageDays))} days\n`;
  if (c.breachCount !== undefined) block += `- Known breaches: ${String(c.breachCount)}\n`;
  return block;
}

export function buildAssistantSystemPrompt(
  scope: ChatScope,
  data?: { credential?: CredentialSafeMeta; aggregate?: VaultSafeAggregate },
): string {
  let prompt = GENERAL_ASSISTANT_SYSTEM_PROMPT_BASE;
  if (scope === 'stateless') {
    prompt += ' You have no access to the user\'s vault contents.';
  } else if (scope === 'curated' && data?.aggregate) {
    prompt += curatedBlock(data.aggregate);
  } else if (scope === 'per-credential' && data?.credential) {
    prompt += credentialBlock(data.credential);
  }
  assertNoSecrets(prompt);
  return prompt;
}
