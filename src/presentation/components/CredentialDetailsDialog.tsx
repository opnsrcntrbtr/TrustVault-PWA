/**
 * Credential Details Dialog Component
 * Full-screen dialog for viewing credential details on mobile
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Slide,
  Alert,
  AlertTitle,
  CircularProgress,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {
  Close,
  ContentCopy,
  Edit,
  Delete,
  Star,
  StarBorder,
  Lock,
  CreditCard,
  Key,
  Note,
  AccountBalance,
  Person,
  Code,
  Shield,
  GppBad,
  CheckCircle,
  Security,
} from '@mui/icons-material';
import type { Credential } from '@/domain/entities/Credential';
import { formatRelativeTime } from '@/presentation/utils/timeFormat';
import { checkPasswordBreach, isHibpEnabled } from '@/core/breach/hibpService';
import { getBreachResult, saveBreachResult } from '@/data/repositories/breachResultsRepository';
import type { BreachCheckResult } from '@/core/breach/breachTypes';
import TotpDisplay from './TotpDisplay';
import BreachDetailsModal from './BreachDetailsModal';

interface CredentialDetailsDialogProps {
  open: boolean;
  credential: Credential | null;
  onClose: () => void;
  onCopyUsername: () => void;
  onCopyPassword: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  const { appear, enter, exit, ...otherProps } = props;
  return (
    <Slide 
      direction="up" 
      ref={ref} 
      appear={appear === undefined ? true : appear}
      enter={enter === undefined ? true : enter}
      exit={exit === undefined ? true : exit}
      {...otherProps}
    />
  );
});

export default function CredentialDetailsDialog({
  open,
  credential,
  onClose,
  onCopyUsername,
  onCopyPassword,
  onEdit,
  onDelete,
  onToggleFavorite,
}: CredentialDetailsDialogProps) {
  const [breachChecking, setBreachChecking] = useState(false);
  const [breachResult, setBreachResult] = useState<BreachCheckResult | null>(null);
  const [breachDetailsOpen, setBreachDetailsOpen] = useState(false);

  useEffect(() => {
    if (open && credential) {
      loadExistingBreachData();
    }
  }, [open, credential]);

  const loadExistingBreachData = async () => {
    if (!credential) return;

    try {
      const result = await getBreachResult(credential.id, 'password');
      setBreachResult(result);
    } catch (error) {
      console.error('Failed to load breach data:', error);
    }
  };

  const handleCheckBreach = async () => {
    if (!credential || !isHibpEnabled()) {
      alert('Breach detection is not enabled. Set VITE_HIBP_API_ENABLED=true in your environment configuration.');
      return;
    }

    setBreachChecking(true);

    try {
      const result = await checkPasswordBreach(credential.password);
      await saveBreachResult(credential.id, 'password', result);
      setBreachResult(result);
    } catch (error) {
      console.error('Breach check failed:', error);
      alert('Failed to check for breaches. Please try again later.');
    } finally {
      setBreachChecking(false);
    }
  };

  if (!credential) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'success';
    }
  };

  const isBreached = breachResult?.breached ?? false;
  const lastChecked = breachResult?.checkedAt
    ? formatRelativeTime(new Date(breachResult.checkedAt))
    : null;

  const getCategoryIcon = () => {
    switch (credential.category) {
      case 'login':
        return <Lock />;
      case 'credit_card':
        return <CreditCard />;
      case 'bank_account':
        return <AccountBalance />;
      case 'identity':
        return <Person />;
      case 'api_key':
        return <Code />;
      case 'ssh_key':
        return <Key />;
      case 'secure_note':
        return <Note />;
      default:
        return <Lock />;
    }
  };

  const getCategoryColor = () => {
    switch (credential.category) {
      case 'login':
        return 'primary';
      case 'credit_card':
        return 'success';
      case 'bank_account':
        return 'info';
      case 'identity':
        return 'secondary';
      case 'api_key':
      case 'ssh_key':
        return 'warning';
      case 'secure_note':
        return 'default';
      default:
        return 'default';
    }
  };

  const getCategoryLabel = () => {
    switch (credential.category) {
      case 'login':
        return 'Login';
      case 'credit_card':
        return 'Card';
      case 'bank_account':
        return 'Bank';
      case 'identity':
        return 'Identity';
      case 'api_key':
        return 'API Key';
      case 'ssh_key':
        return 'SSH Key';
      case 'secure_note':
        return 'Note';
      default:
        return 'Other';
    }
  };

  return (
    <>
    <Dialog fullScreen open={open} onClose={onClose} TransitionComponent={Transition}>
      {/* App Bar */}
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <Close />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Credential Details
          </Typography>
          <IconButton
            color="inherit"
            onClick={onToggleFavorite}
            aria-label={credential.isFavorite ? 'remove from favorites' : 'add to favorites'}
          >
            {credential.isFavorite ? <Star /> : <StarBorder />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box sx={{ p: 2, pb: 10 }}>
        {/* Header with Icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar
            sx={{
              mr: 2,
              bgcolor: `${getCategoryColor()}.main`,
              width: 56,
              height: 56,
            }}
          >
            {getCategoryIcon()}
          </Avatar>
          <Box>
            <Typography variant="h5" gutterBottom>
              {credential.title}
            </Typography>
            <Chip label={getCategoryLabel()} size="small" color={getCategoryColor()} />
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Credential Information */}
        <List>
          {/* Card-specific fields */}
          {credential.category === 'credit_card' ? (
            <>
              {/* Card Number (masked) */}
              {credential.cardNumber && (
                <ListItem>
                  <ListItemText
                    primary="Card Number"
                    secondary={`•••• •••• •••• ${credential.cardNumber.slice(-4)}`}
                  />
                </ListItem>
              )}

              {/* Cardholder Name */}
              {credential.cardholderName && (
                <ListItem>
                  <ListItemText primary="Cardholder Name" secondary={credential.cardholderName} />
                </ListItem>
              )}

              {/* Card Type */}
              {credential.cardType && (
                <ListItem>
                  <ListItemText
                    primary="Card Type"
                    secondary={credential.cardType.charAt(0).toUpperCase() + credential.cardType.slice(1)}
                  />
                </ListItem>
              )}

              {/* Expiry Date */}
              {credential.expiryMonth && credential.expiryYear && (
                <ListItem>
                  <ListItemText
                    primary="Expiry Date"
                    secondary={`${credential.expiryMonth}/${credential.expiryYear}`}
                  />
                </ListItem>
              )}

              {/* CVV (masked) */}
              {credential.cvv && (
                <ListItem>
                  <ListItemText primary="CVV" secondary="•••" />
                </ListItem>
              )}

              {/* Billing Address */}
              {credential.billingAddress && (
                <ListItem>
                  <ListItemText primary="Billing Address" secondary={credential.billingAddress} />
                </ListItem>
              )}
            </>
          ) : (
            <>
              {/* Username */}
              <ListItem>
                <ListItemText primary="Username" secondary={credential.username} />
              </ListItem>

              {/* Password (masked) */}
              <ListItem>
                <ListItemText primary="Password" secondary="••••••••••••" />
              </ListItem>
            </>
          )}

          {/* URL */}
          {credential.url && (
            <ListItem>
              <ListItemText
                primary="Website"
                secondary={
                  <a
                    href={credential.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit' }}
                  >
                    {credential.url}
                  </a>
                }
              />
            </ListItem>
          )}

          {/* TOTP */}
          {credential.totpSecret && (
            <ListItem>
              <Box sx={{ width: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  Two-Factor Authentication
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <TotpDisplay totpSecret={credential.totpSecret} />
                </Box>
              </Box>
            </ListItem>
          )}

          {/* Tags */}
          {credential.tags.length > 0 && (
            <ListItem>
              <Box sx={{ width: '100%' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {credential.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="filled" />
                  ))}
                </Box>
              </Box>
            </ListItem>
          )}

          {/* Notes */}
          {credential.notes && (
            <ListItem>
              <ListItemText primary="Notes" secondary={credential.notes} />
            </ListItem>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Breach Detection Section */}
        {credential.category !== 'credit_card' && credential.category !== 'secure_note' && (
          <Box sx={{ px: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Security fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight="600">
                Breach Detection
              </Typography>
            </Box>

            {!isHibpEnabled() ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Breach detection is not enabled.
              </Alert>
            ) : isBreached ? (
              <Alert
                severity={getSeverityColor(breachResult?.severity || 'medium')}
                sx={{ mb: 2 }}
                action={
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => { setBreachDetailsOpen(true); }}
                  >
                    Details
                  </Button>
                }
              >
                <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GppBad />
                  Password Compromised
                </AlertTitle>
                This password has been seen{' '}
                <strong>{breachResult?.breachCount?.toLocaleString()}</strong> time
                {breachResult?.breachCount === 1 ? '' : 's'} in data breaches.
                {lastChecked && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Last checked {lastChecked}
                  </Typography>
                )}
              </Alert>
            ) : breachResult ? (
              <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
                <AlertTitle>Password Secure</AlertTitle>
                Not found in known data breaches.
                {lastChecked && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Last checked {lastChecked}
                  </Typography>
                )}
              </Alert>
            ) : null}

            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={breachChecking ? <CircularProgress size={16} /> : <Shield />}
              onClick={handleCheckBreach}
              disabled={breachChecking}
            >
              {breachChecking ? 'Checking...' : lastChecked ? 'Re-check for Breaches' : 'Check for Breaches'}
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Metadata */}
        <List>
          <ListItem>
            <ListItemText
              primary="Last Updated"
              secondary={formatRelativeTime(credential.updatedAt)}
            />
          </ListItem>
        </List>
      </Box>

      {/* Bottom Action Bar */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          gap: 1,
        }}
      >
        {credential.category === 'credit_card' ? (
          <>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => {
                if (credential.cardNumber) {
                  navigator.clipboard.writeText(credential.cardNumber);
                }
              }}
              fullWidth
            >
              Card #
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={() => {
                if (credential.cvv) {
                  navigator.clipboard.writeText(credential.cvv);
                }
              }}
              fullWidth
            >
              CVV
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={onCopyUsername}
              fullWidth
            >
              Username
            </Button>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={onCopyPassword}
              fullWidth
            >
              Password
            </Button>
          </>
        )}
        <Button variant="outlined" startIcon={<Edit />} onClick={onEdit} fullWidth>
          Edit
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={onDelete}
          fullWidth
        >
          Delete
        </Button>
      </Box>
    </Dialog>

    {/* Breach Details Modal */}
    {breachResult && isBreached && (
      <BreachDetailsModal
        open={breachDetailsOpen}
        onClose={() => { setBreachDetailsOpen(false); }}
        breaches={breachResult.breaches}
        credentialTitle={credential.title}
        severity={breachResult.severity}
        {...(breachResult.breachCount !== undefined && { breachCount: breachResult.breachCount })}
        onChangePassword={() => {
          setBreachDetailsOpen(false);
          onEdit();
          onClose();
        }}
      />
    )}
    </>
  );
}
