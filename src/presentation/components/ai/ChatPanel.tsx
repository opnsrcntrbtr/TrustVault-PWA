import { useState, type ReactNode, type JSX } from 'react';
import { Box, Stack, TextField, Button, Typography, Chip, Alert } from '@mui/material';
import type { ChatMessage } from '@/core/ai/chat/chatTypes';

export interface ChatPanelProps {
  messages: ChatMessage[];
  streaming: boolean;
  error: boolean;
  onSend: (text: string) => void | Promise<void>;
  onStop: () => void;
  onRetry: () => void;
  suggestions?: string[];
  header?: ReactNode;
}

const DISCLAIMER = 'Replies are generated on your device and never leave it. Avoid pasting real passwords.';

export function ChatPanel(props: ChatPanelProps): JSX.Element {
  const { messages, streaming, error, onSend, onStop, onRetry, suggestions, header } = props;
  const [input, setInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    void onSend(text);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {header}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        ⓘ {DISCLAIMER}
      </Typography>

      <Stack spacing={1} sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
          >
            <Typography
              variant="body2"
              sx={{
                px: 1.5, py: 1, borderRadius: 2,
                bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
                color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </Typography>
          </Box>
        ))}
      </Stack>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
          Could not generate a response.
        </Alert>
      )}

      {suggestions && suggestions.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} size="small" onClick={() => { void onSend(s); }} />
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth size="small" placeholder="Ask a follow-up…"
          value={input}
          onChange={(e) => { setInput(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        {streaming
          ? <Button variant="outlined" onClick={onStop}>Stop</Button>
          : <Button variant="contained" onClick={submit} disabled={!input.trim()}>Send</Button>}
      </Stack>
    </Box>
  );
}
