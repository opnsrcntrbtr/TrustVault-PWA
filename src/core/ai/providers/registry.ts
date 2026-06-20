/**
 * Active-provider selection. Prefers Chrome built-in when available; otherwise
 * falls back to WebLLM when WebGPU is present and the mobile surface is enabled.
 */
import type { AiProvider } from '@/core/ai/providers/types';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
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

  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = webllmProvider;
    return cached;
  }
  cached = null;
  return cached;
}
