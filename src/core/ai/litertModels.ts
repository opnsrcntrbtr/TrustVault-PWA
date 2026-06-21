/**
 * Catalog of LiteRT-LM prebuilt models offered on Android (A/B vs. WebLLM).
 * `url` must resolve to a `-Web.litertlm` file under the HF origins already
 * allowlisted for WebLLM (huggingface.co / *.xethub.hf.co / *.aws.cdn.hf.co).
 */
export interface LitertModel {
  id: string;
  label: string;
  tier: 'tiny' | 'small' | 'mid';
  url: string;
  approxMB: number;
}

export const LITERT_MODELS: ReadonlyArray<LitertModel> = [
  // Tiny tier first: lightest warm-up footprint, best chance of surviving
  // low-end/older Adreno GPUs where larger models are more likely to exceed
  // the warm-up memory budget (same rationale as the WebLLM Tiny tier).
  {
    id: 'gemma-3n-E2B-it',
    label: 'Tiny — Gemma 3n E2B (most compatible)',
    tier: 'tiny',
    url: 'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4-Web.litertlm',
    approxMB: 1500,
  },
  {
    id: 'gemma-3n-E4B-it',
    label: 'Small — Gemma 3n E4B',
    tier: 'small',
    url: 'https://huggingface.co/google/gemma-3n-E4B-it-litert-lm/resolve/main/gemma-3n-E4B-it-int4-Web.litertlm',
    approxMB: 2700,
  },
];

export const DEFAULT_LITERT_MODEL_ID = 'gemma-3n-E2B-it';

export function getLitertModelById(id: string): LitertModel | undefined {
  return LITERT_MODELS.find((m) => m.id === id);
}
