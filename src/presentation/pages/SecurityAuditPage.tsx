/**
 * Security Audit Page
 * Shows credential health dashboard with weak, reused, and old passwords
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  AlertTitle,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  Warning,
  CheckCircle,
  Error,
  Info,
  Security,
  ContentCopy,
  Schedule,
  Shield,
  Refresh,
  Visibility,
} from '@mui/icons-material';
import { useCredentialStore } from '../store/credentialStore';
import { analyzePasswordStrength } from '@/core/crypto/password';
import { checkPasswordBreach, isHibpEnabled } from '@/core/breach/hibpService';
import {
  saveBreachResult,
  getBreachStatistics,
  getAllBreachedCredentials,
} from '@/data/repositories/breachResultsRepository';
import type { BreachCheckResult } from '@/core/breach/breachTypes';
import BreachDetailsModal from '../components/BreachDetailsModal';

interface SecurityIssue {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'weak' | 'reused' | 'old' | 'no-password' | 'breached';
  credentialTitle: string;
  credentialId?: string;
  details: string;
  breachData?: BreachCheckResult;
}

export default function SecurityAuditPage() {
  const navigate = useNavigate();
  const { credentials } = useCredentialStore();
  const [loading, setLoading] = useState(true);
  const [securityScore, setSecurityScore] = useState(0);
  const [issues, setIssues] = useState<SecurityIssue[]>([]);
  const [breachScanning, setBreachScanning] = useState(false);
  const [breachStats, setBreachStats] = useState({
    total: 0,
    breached: 0,
    safe: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, safe: 0 },
  });
  const [selectedBreach, setSelectedBreach] = useState<{
    breaches: BreachCheckResult;
    title: string;
  } | null>(null);

  useEffect(() => {
    analyzeCredentials();
    loadBreachStats();
  }, [credentials]);

  const analyzeCredentials = async () => {
    setLoading(true);

    const foundIssues: SecurityIssue[] = [];
    const passwordMap = new Map<string, string[]>(); // password -> [credential titles]
    let totalScore = 0;
    const credentialCount = credentials.length;

    // Load breach data if available
    let breachedCredentials: Array<{
      credentialId: string;
      checkType: 'password' | 'email';
      severity: string;
      breachCount: number;
      breachNames: string[];
      checkedAt: number;
    }> = [];

    if (isHibpEnabled()) {
      try {
        breachedCredentials = await getAllBreachedCredentials();
      } catch (error) {
        console.error('Failed to load breach data:', error);
      }
    }

    // Analyze each credential
    credentials.forEach((cred) => {
      // Check for breaches first (highest priority)
      const breach = breachedCredentials.find(b => b.credentialId === cred.id && b.checkType === 'password');
      if (breach) {
        const severityMap: { [key: string]: 'critical' | 'high' | 'medium' | 'low' } = {
          critical: 'critical',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        foundIssues.push({
          id: `${cred.id}-breached`,
          title: 'Password Found in Data Breach',
          severity: severityMap[breach.severity] || 'critical',
          type: 'breached',
          credentialTitle: cred.title,
          credentialId: cred.id,
          details: `This password has been seen ${breach.breachCount.toLocaleString()} time${breach.breachCount === 1 ? '' : 's'} in data breaches. Change it immediately!`,
          breachData: {
            breached: true,
            breaches: [],
            severity: breach.severity as any,
            checkedAt: breach.checkedAt,
            breachCount: breach.breachCount,
          },
        });
      }

      // Check if password exists
      if (!cred.password || cred.password.trim() === '') {
        foundIssues.push({
          id: `${cred.id}-no-password`,
          title: 'Missing Password',
          severity: 'medium',
          type: 'no-password',
          credentialTitle: cred.title,
          credentialId: cred.id,
          details: 'This credential has no password set.',
        });
        return;
      }

      // Check password strength
      const strength = analyzePasswordStrength(cred.password);

      if (strength.score < 60) {
        foundIssues.push({
          id: `${cred.id}-weak`,
          title: 'Weak Password',
          severity: strength.score < 40 ? 'critical' : 'high',
          type: 'weak',
          credentialTitle: cred.title,
          credentialId: cred.id,
          details: `Password strength: ${strength.strength}. ${strength.feedback.join(' ')}`,
        });
      }

      // Track for reuse detection
      if (passwordMap.has(cred.password)) {
        passwordMap.get(cred.password)!.push(cred.title);
      } else {
        passwordMap.set(cred.password, [cred.title]);
      }

      // Check password age (if updatedAt available)
      if (cred.updatedAt) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(cred.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceUpdate > 365) {
          foundIssues.push({
            id: `${cred.id}-old`,
            title: 'Password Not Updated',
            severity: daysSinceUpdate > 730 ? 'high' : 'medium',
            type: 'old',
            credentialTitle: cred.title,
            credentialId: cred.id,
            details: `Password is ${daysSinceUpdate} days old. Consider updating for better security.`,
          });
        }
      }

      // Add to total score
      totalScore += strength.score;
    });

    // Check for reused passwords
    passwordMap.forEach((titles, password) => {
      if (titles.length > 1) {
        foundIssues.push({
          id: `reused-${password.substring(0, 8)}`,
          title: 'Reused Password',
          severity: 'high',
          type: 'reused',
          credentialTitle: titles.join(', '),
          details: `This password is used on ${titles.length} accounts: ${titles.join(', ')}`,
        });
      }
    });

    // Calculate overall security score (0-100)
    const avgPasswordScore = credentialCount > 0 ? (totalScore / credentialCount) * 20 : 100; // Convert 0-5 to 0-100
    const issuesPenalty = Math.min(foundIssues.length * 5, 50); // Max 50 point penalty
    const finalScore = Math.max(0, Math.min(100, avgPasswordScore - issuesPenalty));

    setSecurityScore(Math.round(finalScore));
    setIssues(foundIssues);
    setLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'error';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <Error color="error" />;
      case 'medium':
        return <Warning color="warning" />;
      case 'low':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const loadBreachStats = async () => {
    try {
      const stats = await getBreachStatistics();
      setBreachStats(stats);
    } catch (error) {
      console.error('Failed to load breach stats:', error);
    }
  };

  const scanForBreaches = async () => {
    if (!isHibpEnabled()) {
      alert('Breach detection is not enabled. Set VITE_HIBP_API_ENABLED=true in your environment configuration.');
      return;
    }

    setBreachScanning(true);

    try {
      let scannedCount = 0;
      const totalCount = credentials.length;

      for (const credential of credentials) {
        if (!credential.password || credential.password.trim() === '') {
          continue;
        }

        try {
          const result = await checkPasswordBreach(credential.password);
          await saveBreachResult(credential.id, 'password', result);

          if (result.breached) {
            console.log(`Breach detected for ${credential.title}: ${result.breachCount} times`);
          }

          scannedCount++;

          // Update progress
          if (scannedCount % 5 === 0) {
            console.log(`Scanned ${scannedCount}/${totalCount} credentials`);
          }
        } catch (error) {
          console.error(`Failed to check breach for ${credential.title}:`, error);
        }
      }

      // Reload stats and issues
      await loadBreachStats();
      await analyzeCredentials();

      alert(`Scan complete! Checked ${scannedCount} credentials.`);
    } catch (error) {
      console.error('Breach scan failed:', error);
      alert('Failed to complete breach scan. Please try again later.');
    } finally {
      setBreachScanning(false);
    }
  };

  const handleViewBreachDetails = (issue: SecurityIssue) => {
    if (issue.breachData) {
      setSelectedBreach({
        breaches: issue.breachData,
        title: issue.credentialTitle,
      });
    }
  };

  const issuesByType = {
    weak: issues.filter((i) => i.type === 'weak').length,
    reused: issues.filter((i) => i.type === 'reused').length,
    old: issues.filter((i) => i.type === 'old').length,
    noPassword: issues.filter((i) => i.type === 'no-password').length,
    breached: issues.filter((i) => i.type === 'breached').length,
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 4 }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Security sx={{ ml: 2, mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Security Audit
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4 }}>
        {/* Security Score */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Vault Security Score
          </Typography>

          {loading ? (
            <Box sx={{ my: 4 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Analyzing {credentials.length} credentials...
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ position: 'relative', display: 'inline-flex', my: 3 }}>
                <Box
                  sx={{
                    width: 150,
                    height: 150,
                    borderRadius: '50%',
                    border: `8px solid`,
                    borderColor: `${getScoreColor(securityScore)}.main`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <Typography variant="h2" fontWeight="bold">
                    {securityScore}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    / 100
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" color={`${getScoreColor(securityScore)}.main`} gutterBottom>
                {getScoreLabel(securityScore)}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {issues.length === 0
                  ? 'All credentials are secure! Great job maintaining strong passwords.'
                  : `${issues.length} security ${issues.length === 1 ? 'issue' : 'issues'} found across ${credentials.length} credentials.`}
              </Typography>
            </>
          )}
        </Paper>

        {/* Breach Detection Card */}
        {!loading && isHibpEnabled() && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Shield color={breachStats.breached > 0 ? 'error' : 'success'} />
                <Typography variant="h6">Breach Detection</Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={breachScanning ? <CircularProgress size={16} /> : <Refresh />}
                onClick={scanForBreaches}
                disabled={breachScanning}
              >
                {breachScanning ? 'Scanning...' : 'Scan All'}
              </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="h4" color={breachStats.breached > 0 ? 'error.main' : 'success.main'}>
                  {breachStats.breached}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Breached Passwords
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="success.main">
                  {breachStats.safe}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Safe Passwords
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" color="text.secondary">
                  {breachStats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Checked
                </Typography>
              </Box>
            </Box>

            {breachStats.breached > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Critical: Breached Passwords Detected</AlertTitle>
                {breachStats.breached} of your passwords have been found in data breaches.
                Change them immediately to protect your accounts.
              </Alert>
            )}
          </Paper>
        )}

        {/* Summary Cards */}
        {!loading && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Warning color="error" />
                  <Typography variant="h6">{issuesByType.weak}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Weak Passwords
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ContentCopy color="error" />
                  <Typography variant="h6">{issuesByType.reused}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Reused Passwords
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Schedule color="warning" />
                  <Typography variant="h6">{issuesByType.old}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Old Passwords (1+ year)
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Info color="warning" />
                  <Typography variant="h6">{issuesByType.noPassword}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Missing Passwords
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Issues List */}
        {!loading && issues.length > 0 && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Security Issues
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Review and fix these issues to improve your vault security score.
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <List>
              {issues.map((issue) => (
                <ListItem
                  key={issue.id}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    alignItems: 'flex-start',
                  }}
                >
                  <ListItemIcon sx={{ mt: 1 }}>{getSeverityIcon(issue.severity)}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2">{issue.title}</Typography>
                        <Chip
                          label={issue.severity.toUpperCase()}
                          size="small"
                          color={getSeverityColor(issue.severity) as any}
                        />
                        {issue.type === 'breached' && (
                          <Chip
                            label="BREACHED"
                            size="small"
                            color="error"
                            icon={<Shield />}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                          {issue.credentialTitle}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {issue.details}
                        </Typography>
                        {issue.type === 'breached' && issue.breachData && (
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            startIcon={<Visibility />}
                            onClick={() => { handleViewBreachDetails(issue); }}
                            sx={{ mt: 1 }}
                          >
                            View Breach Details
                          </Button>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {/* No Issues */}
        {!loading && issues.length === 0 && (
          <Alert severity="success" icon={<CheckCircle />}>
            <AlertTitle>All Clear!</AlertTitle>
            Your vault is secure. All passwords are strong, unique, and up to date.
          </Alert>
        )}

        {/* Recommendations */}
        {!loading && issues.length > 0 && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <AlertTitle>Security Recommendations</AlertTitle>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              {issuesByType.breached > 0 && (
                <li>
                  <strong>Change breached passwords immediately:</strong> Passwords found in data breaches
                  are at high risk of being used by attackers. Update them right away.
                </li>
              )}
              {issuesByType.weak > 0 && (
                <li>
                  <strong>Strengthen weak passwords:</strong> Use the password generator to create strong,
                  random passwords (16+ characters with mixed case, numbers, and symbols).
                </li>
              )}
              {issuesByType.reused > 0 && (
                <li>
                  <strong>Use unique passwords:</strong> Never reuse passwords across different accounts.
                  If one site is compromised, all accounts with that password are at risk.
                </li>
              )}
              {issuesByType.old > 0 && (
                <li>
                  <strong>Update old passwords:</strong> Change passwords that haven't been updated in over
                  a year, especially for sensitive accounts (email, banking, etc.).
                </li>
              )}
              {issuesByType.noPassword > 0 && (
                <li>
                  <strong>Add missing passwords:</strong> Complete your credential entries by adding
                  passwords where they're missing.
                </li>
              )}
            </ul>
          </Alert>
        )}
      </Container>

      {/* Breach Details Modal */}
      {selectedBreach && (
        <BreachDetailsModal
          open={true}
          onClose={() => { setSelectedBreach(null); }}
          breaches={selectedBreach.breaches.breaches}
          credentialTitle={selectedBreach.title}
          severity={selectedBreach.breaches.severity}
          breachCount={selectedBreach.breaches.breachCount ?? 0}
        />
      )}
    </Box>
  );
}
