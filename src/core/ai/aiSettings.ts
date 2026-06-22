/**
 * On-device AI settings (enabled by default).
 * localStorage module — mirrors autofillSettings.ts. No Zustand.
 */
import { DEFAULT_WEBLLM_MODEL_ID } from '@/core/ai/webllmModels';
import { DEFAULT_LITERT_MODEL_ID } from '@/core/ai/litertModels';
import type { ChatScope } from '@/core/ai/chat/chatTypes';

export interface AiSettings {
  /** Master toggle for Chrome built-in AI. */
  enableOnDeviceAI: boolean;
  /** Feature toggle for the strength-explanation feature. */
  allowStrengthExplanation: boolean;
  /** Feature toggle for breach impact analysis feature. */
  allowBreachImpactAnalysis: boolean;
  /** Selected WebLLM model id (Android on-device backend). */
  webLlmModelId: string;
  /** Cached flag: WebLLM weights downloaded & usable. Verified against cache on load. */
  mobileAiModelReady: boolean;
  /** Which Android on-device engine to prefer (A/B vs. WebLLM's Adreno failure). */
  mobileInferenceEngine: 'litert-lm' | 'webllm';
  /** Selected LiteRT-LM model id (Android on-device backend). */
  litertModelId: string;
  /** Cached flag: LiteRT-LM weights downloaded & usable. Verified against cache on load. */
  litertModelReady: boolean;
  /** Follow-up chat in the inline strength/breach panels. */
  allowChatFollowUp: boolean;
  /** Show the standalone general assistant entry point. */
  enableGeneralAssistant: boolean;
  /** Scope the standalone assistant opens with. */
  generalAssistantDefaultScope: ChatScope;
}

const STORAGE_KEY = 'trustvault_ai_settings';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enableOnDeviceAI: true,
  allowStrengthExplanation: true,
  allowBreachImpactAnalysis: true,
  webLlmModelId: DEFAULT_WEBLLM_MODEL_ID,
  mobileAiModelReady: false,
  mobileInferenceEngine: 'litert-lm',
  litertModelId: DEFAULT_LITERT_MODEL_ID,
  litertModelReady: false,
  allowChatFollowUp: true,
  enableGeneralAssistant: true,
  generalAssistantDefaultScope: 'stateless',
};

export function loadAiSettings(): AiSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AiSettings>;
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load AI settings:', error);
  }
  return DEFAULT_AI_SETTINGS;
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save AI settings:', error);
  }
}
