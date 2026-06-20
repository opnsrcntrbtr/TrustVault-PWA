/**
 * Catalog of WebLLM prebuilt models offered on Android.
 * `id` must match @mlc-ai/web-llm prebuiltAppConfig model ids.
 */
export interface WebLlmModel {
  id: string;
  label: string;
  tier: 'small' | 'mid';
  approxMB: number;
}

export const WEBLLM_MODELS: ReadonlyArray<WebLlmModel> = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Small — Llama 3.2 1B', tier: 'small', approxMB: 720 },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Small — Qwen2.5 1.5B', tier: 'small', approxMB: 940 },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Mid — Gemma 2 2B', tier: 'mid', approxMB: 1900 },
];

export const DEFAULT_WEBLLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export function getModelById(id: string): WebLlmModel | undefined {
  return WEBLLM_MODELS.find((m) => m.id === id);
}
