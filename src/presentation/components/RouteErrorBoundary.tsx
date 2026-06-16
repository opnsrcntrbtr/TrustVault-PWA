import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Home, Refresh, Warning } from '@mui/icons-material';
import ErrorBoundary from './ErrorBoundary';

/** In-content fallback for a single crashed page. The app shell stays mounted. */
function RouteErrorFallback({ reset }: { reset: () => void }) {
  const navigate = useNavigate();
  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 2,
          py: 8,
        }}
      >
        <Warning sx={{ fontSize: 64, color: 'error.main' }} />
        <Typography variant="h5" component="h1">
          This page hit an error
        </Typography>
        <Typography color="text.secondary">
          Something went wrong while displaying this page. Your vault data is safe.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="contained" startIcon={<Refresh />} onClick={reset}>
            Try again
          </Button>
          <Button
            variant="outlined"
            startIcon={<Home />}
            onClick={() => navigate('/dashboard')}
          >
            Go to dashboard
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}

/**
 * Per-route error boundary. Uses pathname as a resetKey so a route change
 * auto-clears a prior error WITHOUT remounting the routed content on every
 * navigation. Wrap the routed content with this so a single page crash is
 * isolated to the content area while the shell survives.
 */
export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      resetKey={pathname}
      fallback={(_error, reset) => <RouteErrorFallback reset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}
