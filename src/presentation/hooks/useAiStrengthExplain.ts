import { useCallback, useEffect, useState } from 'react';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import { explainStrengthStructured, STRENGTH_SYSTEM_PROMPT, type StrengthInsight } from '@/core/ai/strengthExplain';
import { warmUpAi } from '@/core/ai/promptApi';
import type { StrengthExplainInput } from '@/core/ai/aiTypes';

interface UseAiStrengthExplain {
  enabled: boolean;
  loading: boolean;
  insight: StrengthInsight | null;
  rawText: string | null;
  error: boolean;
  explain: (input: StrengthExplainInput) => Promise<void>;
  reset: () => void;
}

export function useAiStrengthExplain(): UseAiStrengthExplain {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<StrengthInsight | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const settings = loadAiSettings();
    if (!settings.enableOnDeviceAI || !settings.allowStrengthExplanation) {
      setEnabled(false);
      return () => { mounted = false; };
    }
    getAiAvailability()
      .then((a) => { 
        if (mounted && isFeatureUsable(a)) {
          setEnabled(true);
          warmUpAi(STRENGTH_SYSTEM_PROMPT).catch(console.error);
        }
      })
      .catch((e: unknown) => { console.error('catch block err', e); if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, []);

  const explain = useCallback(async (input: StrengthExplainInput) => {
    setLoading(true);
    setError(false);
    setInsight(null);
    setRawText(null);
    try {
      const result = await explainStrengthStructured(input);
      if ('insight' in result) {
        setInsight(result.insight);
      } else {
        setRawText(result.raw);
      }
    } catch {
      setError(true);
      setInsight(null);
      setRawText(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInsight(null);
    setRawText(null);
    setError(false);
    setLoading(false);
  }, []);

  return { enabled, loading, insight, rawText, error, explain, reset };
}
