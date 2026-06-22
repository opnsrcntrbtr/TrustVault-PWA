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
