/**
 * Conversation history trimming for the 2048-token context cap shared by both
 * on-device backends. Keeps the system message plus the most recent turns.
 */

/** User+assistant messages retained (the system message is always kept). */
export const MAX_CHAT_TURNS = 8;

/** Mutates `messages` in place: keeps a leading system message + last `maxTurns`. */
export function trimChatMessages(messages: { role: string }[], maxTurns: number): void {
  const hasSystem = messages[0]?.role === 'system' ? 1 : 0;
  const nonSystem = messages.length - hasSystem;
  if (nonSystem <= maxTurns) return;
  messages.splice(hasSystem, nonSystem - maxTurns);
}

export interface UsageStatus { usage: number; quota: number; nearLimit: boolean; }

/**
 * Quota-aware alternative to the turn-count heuristic above (chrome-builtin
 * only; other providers' sessions lack measureUsage and return null here).
 */
export async function checkChatUsage(
  session: { measureUsage?: (text: string) => Promise<{ usage: number; quota: number } | null> },
  pendingText: string,
  threshold = 0.8,
): Promise<UsageStatus | null> {
  if (typeof session.measureUsage !== 'function') return null;
  const r = await session.measureUsage(pendingText);
  if (!r || r.quota <= 0) return null;
  return { usage: r.usage, quota: r.quota, nearLimit: r.usage / r.quota >= threshold };
}
