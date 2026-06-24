import { useCallback, useEffect, useState, useRef } from 'react';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import {
  explainBreachImpactStructured,
  type BreachImpactExplainInput,
  type BreachInsight,
  BREACH_SYSTEM_PROMPT,
} from '@/core/ai/breachImpactExplain';
import { warmUpAi } from '@/core/ai/promptApi';

interface UseAiBreachImpactExplain {
  enabled: boolean;
  loading: boolean;
  insight: BreachInsight | null;
  rawText: string | null;
  error: boolean;
  analyze: (input: BreachImpactExplainInput) => Promise<void>;
  reset: () => void;
}

export function useAiBreachImpactExplain(): UseAiBreachImpactExplain {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<BreachInsight | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // Keep track of the current abort controller so we can cancel previous streams
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    const settings = loadAiSettings();
    if (!settings.enableOnDeviceAI || !settings.allowBreachImpactAnalysis) {
      setEnabled(false);
      return () => { mounted = false; };
    }
    getAiAvailability()
      .then((a) => { 
        if (mounted && isFeatureUsable(a)) {
          setEnabled(true);
          warmUpAi(BREACH_SYSTEM_PROMPT).catch(console.error);
        }
      })
      .catch(() => { if (mounted) setEnabled(false); });
    return () => { mounted = false; };
  }, []);

  const analyze = useCallback(async (input: BreachImpactExplainInput) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(false);
    setInsight(null);
    setRawText(null);

    try {
      const result = await explainBreachImpactStructured(input, abortController.signal);
      if ('insight' in result) {
        setInsight(result.insight);
      } else {
        setRawText(result.raw);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Ignored
      } else {
        console.error('AI Breach Analysis Error:', err);
        setError(true);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setInsight(null);
    setRawText(null);
    setError(false);
    setLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { enabled, loading, insight, rawText, error, analyze, reset };
}
