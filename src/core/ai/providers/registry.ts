/**
 * Active-provider selection. Prefers Chrome built-in when available; otherwise
 * falls back to WebLLM when WebGPU is present and the mobile surface is enabled.
 * (WebLLM branch wired in Task 6.)
 */
import type { AiProvider } from '@/core/ai/providers/types';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { hasWebGpu, isMobileAiSurfaceEnabled } from '@/core/ai/providers/capabilities';

let cached: AiProvider | null | undefined;
let override: AiProvider | null | undefined;

export function __setActiveProviderForTesting(p: AiProvider | null): void { override = p; }
export function __resetRegistryForTesting(): void { cached = undefined; override = undefined; }

export async function getActiveProvider(): Promise<AiProvider | null> {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;

  const chromeAvail = await chromeBuiltinProvider.getAvailability();
  if (chromeAvail === 'available') { cached = chromeBuiltinProvider; return cached; }

  // WebLLM fallback (wired in Task 6). Until then, only enable when WebGPU +
  // mobile surface are present so selection logic is testable.
  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = null; // placeholder until webllmProvider is registered
    return cached;
  }
  cached = null;
  return cached;
}
