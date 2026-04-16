/**
 * CryptoAPIError Component
 * Displays error message when Web Crypto API is not available
 * Helps users understand HTTPS requirement
 */

import { Alert, AlertTitle, Box, Button, Container, Typography } from '@mui/material';
import { Lock, Warning } from '@mui/icons-material';

interface CryptoAPIErrorProps {
  currentUrl: string;
}

export default function CryptoAPIError({ currentUrl }: CryptoAPIErrorProps) {
  const isLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');
  const isHTTPS = currentUrl.startsWith('https://');

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 3,
          py: 4,
        }}
      >
        <Warning sx={{ fontSize: 80, color: 'error.main' }} />

        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Secure Connection Required
        </Typography>

        <Alert severity="error" sx={{ width: '100%' }}>
          <AlertTitle>Web Crypto API Unavailable</AlertTitle>
          TrustVault requires the Web Crypto API to encrypt your passwords. This API is only
          available in secure contexts (HTTPS or localhost).
        </Alert>

        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1">
            <strong>Current URL:</strong> <code>{currentUrl}</code>
          </Typography>

          {!isHTTPS && !isLocalhost && (
            <>
              <Typography variant="body1" color="error">
                ❌ This page is not served over HTTPS
              </Typography>

              <Alert severity="info">
                <AlertTitle>For Developers</AlertTitle>
                If you're running in development mode:
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>Use <code>npm run dev</code> (should auto-use localhost)</li>
                  <li>Access via <code>http://localhost:3000</code></li>
                  <li>Or use <code>npm run dev:https</code> for HTTPS in dev</li>
                </ul>
              </Alert>

              <Alert severity="warning">
                <AlertTitle>For Production</AlertTitle>
                TrustVault must be deployed with HTTPS enabled:
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>Use Vercel, Netlify, or any host with automatic HTTPS</li>
                  <li>Configure SSL certificate (Let's Encrypt is free)</li>
                  <li>See <code>DEPLOYMENT.md</code> for detailed instructions</li>
                </ul>
              </Alert>
            </>
          )}

          {isLocalhost && !isHTTPS && (
            <Alert severity="warning">
              <AlertTitle>Localhost Should Work</AlertTitle>
              You're on localhost, but the Web Crypto API is still unavailable. This might be due
              to:
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>Browser extension interference (try incognito mode)</li>
                <li>Browser security settings</li>
                <li>Using an outdated browser</li>
              </ul>
            </Alert>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Lock />}
            onClick={() => { window.location.reload(); }}
          >
            Retry Connection
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              window.open('https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API', '_blank');
            }}
          >
            Learn More
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" align="center">
          TrustVault is a security-first password manager. HTTPS is mandatory to ensure your
          passwords are encrypted properly and transmitted securely.
        </Typography>
      </Box>
    </Container>
  );
}
