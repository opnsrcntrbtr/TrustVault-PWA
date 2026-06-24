/** Languages Gemini Nano supports for input/output (Chrome 149). */
export const SUPPORTED_AI_LANGUAGES = ['en', 'es', 'ja', 'de', 'fr'] as const;
export type SupportedAiLanguage = (typeof SUPPORTED_AI_LANGUAGES)[number];

export function resolveAiLanguage(locale?: string): SupportedAiLanguage {
  if (!locale) return 'en';
  const base = locale.toLowerCase().split('-')[0] ?? '';
  return (SUPPORTED_AI_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedAiLanguage)
    : 'en';
}
