/**
 * Password Strength Indicator Component
 * Displays visual strength indicator and feedback for passwords
 */

import { Box, LinearProgress, Typography, Chip, Button } from '@mui/material';
import { analyzePasswordStrength } from '@/features/vault/generator/strengthAnalyzer';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { buildStrengthPrompt, STRENGTH_SYSTEM_PROMPT } from '@/core/ai/strengthExplain';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';
import { useMemo, useState } from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
  allowAiExplanation?: boolean;
}

export default function PasswordStrengthIndicator({
  password,
  showFeedback = true,
  allowAiExplanation = false,
}: PasswordStrengthIndicatorProps) {
  const analysisResult = useMemo(() => {
    if (!password) {
      return {
        score: 0,
        strength: 'weak' as const,
        feedback: { warning: '', suggestions: [] },
        weaknesses: []
      };
    }
    return analyzePasswordStrength(password);
  }, [password]);

  const [expanded, setExpanded] = useState(false);
  const chat = useAiChat({ systemPrompt: STRENGTH_SYSTEM_PROMPT });
  const aiSettings = loadAiSettings();
  const aiAllowed = aiSettings.enableOnDeviceAI && aiSettings.allowStrengthExplanation;

  // Convert to old format for compatibility
  const analysis = useMemo(() => {
    const strengthMap: Record<string, 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong'> = {
      'weak': 'weak',
      'medium': 'fair',
      'strong': 'strong',
      'very-strong': 'very_strong',
    };

    const feedback: string[] = [];
    if (analysisResult.feedback.warning) {
      feedback.push(analysisResult.feedback.warning);
    }
    feedback.push(...analysisResult.feedback.suggestions);
    feedback.push(...analysisResult.weaknesses);

    return {
      score: analysisResult.score,
      strength: strengthMap[analysisResult.strength] || 'weak',
      feedback,
    };
  }, [analysisResult]);

  const getStrengthColor = () => {
    switch (analysis.strength) {
      case 'very_strong':
        return '#4caf50'; // Green
      case 'strong':
        return '#8bc34a'; // Light green
      case 'fair':
        return '#ff9800'; // Orange
      case 'weak':
        return '#ff5722'; // Deep orange
      case 'very_weak':
        return '#f44336'; // Red
      default:
        return '#9e9e9e'; // Gray
    }
  };

  const getStrengthLabel = () => {
    switch (analysis.strength) {
      case 'very_strong':
        return 'Very Strong';
      case 'strong':
        return 'Strong';
      case 'fair':
        return 'Fair';
      case 'weak':
        return 'Weak';
      case 'very_weak':
        return 'Very Weak';
      default:
        return 'Unknown';
    }
  };

  if (!password) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
        <LinearProgress
          variant="determinate"
          value={analysis.score}
          sx={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: getStrengthColor(),
              borderRadius: 4,
            },
          }}
        />
        <Chip
          label={getStrengthLabel()}
          size="small"
          sx={{
            backgroundColor: getStrengthColor(),
            color: 'white',
            fontWeight: 600,
            minWidth: 90,
          }}
        />
      </Box>

      {showFeedback && analysis.feedback.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {analysis.feedback.map((feedback, index) => (
            <Typography
              key={index}
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ fontSize: '0.75rem', lineHeight: 1.5 }}
            >
              • {feedback}
            </Typography>
          ))}
        </Box>
      )}

      {/* On-device AI strength explanation */}
      {allowAiExplanation && aiAllowed && chat.enabled && (
        <Box sx={{ mt: 1 }}>
          {!expanded ? (
            <Button
              size="small"
              variant="outlined"
              disabled={chat.streaming}
              onClick={() => {
                // Approximate entropy from score for AI input
                const entropyBits = Math.max(0, analysisResult.score);
                setExpanded(true);
                void chat.send(buildStrengthPrompt({ strength: analysisResult.strength, entropyBits }));
              }}
            >
              {chat.streaming ? 'AI is thinking…' : 'Explain with AI'}
            </Button>
          ) : aiSettings.allowChatFollowUp ? (
            <ChatPanel
              messages={chat.messages}
              streaming={chat.streaming}
              error={chat.error}
              onSend={chat.send}
              onStop={chat.stop}
              onRetry={chat.retry}
              suggestions={['How do I make it stronger?', "What's entropy?"]}
            />
          ) : (
            <>
              {chat.error && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  Could not generate an explanation.
                </Typography>
              )}
              {chat.messages.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">{chat.messages.at(-1)?.content}</Typography>
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                    Generated by on-device AI.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
