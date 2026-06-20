import { useCallback, useEffect, useState, useRef } from 'react';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { getAiAvailability, isFeatureUsable } from '@/core/ai/aiAvailability';
import { explainBreachImpact, type BreachImpactExplainInput } from '@/core/ai/breachImpactExplain';

interface UseAiBreachImpactExplain {
  enabled: boolean;
  loading: boolean;
  explanation: string | null;
  error: boolean;
  analyze: (input: BreachImpactExplainInput) => Promise<void>;
  reset: () => void;
}

export function useAiBreachImpactExplain(): UseAiBreachImpactExplain {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
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
      .then((a) => { if (mounted) setEnabled(isFeatureUsable(a)); })
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
    setExplanation(''); // Start with empty string for streaming
    
    try {
      const stream = explainBreachImpact(input, abortController.signal);
      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        setExplanation(fullText);
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
    setExplanation(null);
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

  return { enabled, loading, explanation, error, analyze, reset };
}
