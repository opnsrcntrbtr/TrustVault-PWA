/**
 * Breach Details Modal Component
 * Displays detailed information about detected breaches
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Alert,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import {
  Close,
  Warning,
  Shield,
  CalendarToday,
  People,
  OpenInNew,
  Security,
  Error,
  AutoAwesome,
  ExpandMore,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import type { BreachData, BreachSeverity } from '@/core/breach/breachTypes';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { buildBreachPrompt, BREACH_SYSTEM_PROMPT } from '@/core/ai/breachImpactExplain';
import { loadAiSettings } from '@/core/ai/aiSettings';
import { ChatPanel } from '@/presentation/components/ai/ChatPanel';

interface BreachDetailsModalProps {
  open: boolean;
  onClose: () => void;
  breaches: BreachData[];
  credentialTitle: string;
  severity: BreachSeverity;
  breachCount?: number | undefined;
  onChangePassword?: (() => void) | undefined;
  credentialUsername?: string | undefined;
  credentialCategory?: string | undefined;
  credentialAgeDays?: number | undefined;
}

export default function BreachDetailsModal({
  open,
  onClose,
  breaches,
  credentialTitle,
  severity,
  breachCount,
  onChangePassword,
  credentialUsername,
  credentialCategory,
  credentialAgeDays,
}: BreachDetailsModalProps) {
  const chat = useAiChat({ systemPrompt: BREACH_SYSTEM_PROMPT });
  const aiSettings = loadAiSettings();
  const aiAllowed = aiSettings.enableOnDeviceAI && aiSettings.allowBreachImpactAnalysis;

  const getSeverityColor = (sev: BreachSeverity): 'error' | 'warning' | 'info' | 'success' => {
    switch (sev) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      case 'safe':
        return 'success';
      default:
        return 'info';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <Error color={getSeverityColor(severity)} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="div">
            Data Breach Alert
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {credentialTitle}
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {/* Summary Alert */}
        <Alert
          severity={getSeverityColor(severity)}
          sx={{ mb: 3 }}
          icon={<Warning />}
        >
          {breachCount !== undefined && breachCount > 0 ? (
            <Typography variant="body2">
              <strong>Password Breach:</strong> This password has been seen{' '}
              <strong>{formatNumber(breachCount)}</strong> time
              {breachCount === 1 ? '' : 's'} in data breaches.
              You should change it immediately.
            </Typography>
          ) : breaches.length > 0 ? (
            <Typography variant="body2">
              <strong>Email Breach:</strong> Your email was found in{' '}
              <strong>{breaches.length}</strong> data breach
              {breaches.length === 1 ? '' : 'es'}.
              Review the details below and update your password.
            </Typography>
          ) : (
            <Typography variant="body2">
              This credential may be compromised. Consider updating your password.
            </Typography>
          )}
        </Alert>

        {/* Recommendations */}
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Security color="primary" />
            <Typography variant="subtitle2" fontWeight="600">
              Recommended Actions
            </Typography>
          </Box>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Shield fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Change your password immediately"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Shield fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Use a strong, unique password (16+ characters)"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Shield fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Enable two-factor authentication if available"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Shield fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Check for suspicious account activity"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          </List>
        </Box>

        {/* AI Analysis Section */}
        {aiAllowed && chat.enabled && (
          <Accordion
            sx={{ mb: 3, border: 1, borderColor: 'divider', boxShadow: 'none', '&:before': { display: 'none' } }}
            onChange={(_, expanded) => {
              if (expanded && chat.messages.length === 0 && !chat.streaming) {
                void chat.send(buildBreachPrompt({
                  breaches,
                  credentialTitle,
                  credentialUsername,
                  credentialCategory,
                  credentialAgeDays,
                }));
              }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ backgroundColor: 'action.hover' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesome color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight="600">
                  AI Impact Analysis
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2, pb: 2 }}>
              {chat.streaming && chat.messages.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Analyzing breach impact...
                  </Typography>
                </Box>
              ) : aiSettings.allowChatFollowUp ? (
                <ChatPanel
                  messages={chat.messages}
                  streaming={chat.streaming}
                  error={chat.error}
                  onSend={chat.send}
                  onStop={chat.stop}
                  onRetry={chat.retry}
                  suggestions={['How do I fix this?', 'Should I change my password?']}
                />
              ) : chat.error ? (
                <Alert
                  severity="error"
                  sx={{ mb: 1 }}
                  action={
                    <Button color="inherit" size="small" onClick={chat.retry}>
                      Retry
                    </Button>
                  }
                >
                  Failed to generate AI analysis.
                </Alert>
              ) : chat.messages.length > 0 ? (
                <Box>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ whiteSpace: 'pre-line' }}
                  >
                    {chat.messages.at(-1)?.content}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
                    Generated securely on-device by on-device AI.
                  </Typography>
                </Box>
              ) : null}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Breach Details */}
        {breaches.length > 0 && (
          <>
            <Typography variant="subtitle2" fontWeight="600" gutterBottom>
              Breach Details ({breaches.length})
            </Typography>

            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {breaches.map((breach) => (
                <Box
                  key={breach.name}
                  sx={{
                    mb: 2,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
                      {breach.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {breach.isVerified && (
                        <Chip label="Verified" size="small" color="error" />
                      )}
                      {breach.isSensitive && (
                        <Chip label="Sensitive" size="small" color="warning" />
                      )}
                    </Box>
                  </Box>

                  {breach.domain && (
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {breach.domain}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(breach.breachDate)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <People sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatNumber(breach.pwnCount)} accounts
                      </Typography>
                    </Box>
                  </Box>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(breach.description, { USE_PROFILES: { html: true } }),
                    }}
                  />

                  {breach.dataClasses && breach.dataClasses.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Compromised data:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {breach.dataClasses.map(dc => (
                          <Chip key={dc} label={dc} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Link
                    href={`https://haveibeenpwned.com/PwnedWebsites#${breach.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1 }}
                  >
                    <Typography variant="caption">
                      Learn more
                    </Typography>
                    <OpenInNew sx={{ fontSize: 12 }} />
                  </Link>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* HIBP Attribution */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Breach data provided by{' '}
            <Link
              href="https://haveibeenpwned.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Have I Been Pwned
            </Link>
            , a free service created by Troy Hunt to help people check if their
            accounts have been compromised.
          </Typography>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        {onChangePassword && (
          <Button
            onClick={onChangePassword}
            variant="contained"
            color={getSeverityColor(severity)}
            startIcon={<Shield />}
          >
            Change Password
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
