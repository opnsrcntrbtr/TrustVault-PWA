import type { VaultSafeAggregate } from '@/core/ai/chat/chatTypes';

export interface CredentialSummary {
  category?: string | undefined;
  ageDays?: number | undefined;
  isWeak?: boolean | undefined;
  isReused?: boolean | undefined;
  breachCount?: number | undefined;
}

export function computeVaultSafeAggregate(items: CredentialSummary[]): VaultSafeAggregate {
  const categories: Record<string, number> = {};
  let weak = 0, reused = 0, breached = 0;
  let oldest: number | undefined;
  for (const it of items) {
    if (it.isWeak) weak += 1;
    if (it.isReused) reused += 1;
    if ((it.breachCount ?? 0) > 0) breached += 1;
    if (it.category) categories[it.category] = (categories[it.category] ?? 0) + 1;
    if (it.ageDays !== undefined) oldest = oldest === undefined ? it.ageDays : Math.max(oldest, it.ageDays);
  }
  return { total: items.length, weak, reused, breached, categories, oldestPasswordAgeDays: oldest };
}
