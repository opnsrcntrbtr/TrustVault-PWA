/** Runtime data-access scope for the standalone general assistant. */
export type ChatScope = 'stateless' | 'curated' | 'per-credential';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** Non-secret per-credential metadata safe to send to the model. */
export interface CredentialSafeMeta {
  title: string;
  username?: string | undefined;
  category?: string | undefined;
  ageDays?: number | undefined;
  breachCount?: number | undefined;
}

/** Non-secret vault-wide aggregate safe to send to the model. */
export interface VaultSafeAggregate {
  total: number;
  weak: number;
  reused: number;
  breached: number;
  categories: Record<string, number>;
  oldestPasswordAgeDays?: number | undefined;
}
