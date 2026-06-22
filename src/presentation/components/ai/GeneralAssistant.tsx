import { useMemo, useState, type JSX } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, MenuItem, Select, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { buildAssistantSystemPrompt } from '@/core/ai/chat/chatContext';
import { loadAiSettings } from '@/core/ai/aiSettings';
import type { ChatScope } from '@/core/ai/chat/chatTypes';

export interface GeneralAssistantProps { open: boolean; onClose: () => void; }

const SCOPE_LABELS: Record<ChatScope, string> = {
  'stateless': 'No vault data',
  'curated': 'Vault summary',
  'per-credential': 'One credential',
};

export function GeneralAssistant({ open, onClose }: GeneralAssistantProps): JSX.Element | null {
  const [scope, setScope] = useState<ChatScope>(() => loadAiSettings().generalAssistantDefaultScope);
  // Curated/per-credential data wiring is intentionally minimal here: stateless ships first.
  const systemPrompt = useMemo(() => buildAssistantSystemPrompt(scope), [scope]);
  const chat = useAiChat({ systemPrompt });

  if (!open) return null;

  const handleScope = (next: ChatScope) => {
    if (next === scope) return;
    chat.reset();
    setScope(next);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        AI Assistant
        <IconButton aria-label="close" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1}>
          <Select
            size="small"
            value={scope}
            inputProps={{ 'aria-label': 'scope' }}
            onChange={(e) => handleScope(e.target.value as ChatScope)}
          >
            {(Object.keys(SCOPE_LABELS) as ChatScope[]).map((s) => (
              <MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>
            ))}
          </Select>
          {!chat.enabled && (
            <Typography variant="body2" color="text.secondary">
              On-device AI is unavailable on this device.
            </Typography>
          )}
          <ChatPanel
            messages={chat.messages}
            streaming={chat.streaming}
            error={chat.error}
            onSend={chat.send}
            onStop={chat.stop}
            onRetry={chat.retry}
            suggestions={['How do I make a strong passphrase?', "What's a passkey?"]}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
