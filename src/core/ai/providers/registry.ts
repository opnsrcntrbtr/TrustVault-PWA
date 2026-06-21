/**
 * Active-provider selection. Prefers Chrome built-in when available; otherwise
 * on Android with WebGPU and the mobile surface enabled, picks the engine
 * named by aiSettings.mobileInferenceEngine, falling back to whichever other
 * mobile engine is enabled if the chosen one isn't.
 */
import type { AiProvider } from '@/core/ai/providers/types';
import { chromeBuiltinProvider } from '@/core/ai/providers/chromeBuiltinProvider';
import { webllmProvider } from '@/core/ai/providers/webllmProvider';
import { litertProvider } from '@/core/ai/providers/litertProvider';
import { hasWebGpu, isMobileAiSurfaceEnabled, isLitertEnabled, isWebllmEnabled } from '@/core/ai/providers/capabilities';
import { loadAiSettings } from '@/core/ai/aiSettings';

let cached: AiProvider | null | undefined;
let override: AiProvider | null | undefined;

export function __setActiveProviderForTesting(p: AiProvider | null): void { override = p; }
export function __resetRegistryForTesting(): void { cached = undefined; override = undefined; }

function selectMobileProvider(): AiProvider | null {
  const preferred = loadAiSettings().mobileInferenceEngine;
  if (preferred === 'litert-lm' && isLitertEnabled()) return litertProvider;
  if (preferred === 'webllm' && isWebllmEnabled()) return webllmProvider;
  // Chosen engine disabled — fall back to whichever other engine is enabled.
  if (isLitertEnabled()) return litertProvider;
  if (isWebllmEnabled()) return webllmProvider;
  return null;
}

export async function getActiveProvider(): Promise<AiProvider | null> {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;

  const chromeAvail = await chromeBuiltinProvider.getAvailability();
  if (chromeAvail === 'available') { cached = chromeBuiltinProvider; return cached; }

  if (isMobileAiSurfaceEnabled() && (await hasWebGpu())) {
    cached = selectMobileProvider();
    return cached;
  }
  cached = null;
  return cached;
}
