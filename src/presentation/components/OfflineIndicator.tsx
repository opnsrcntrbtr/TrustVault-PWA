import { useEffect, useState } from 'react';
import { Alert, Slide } from '@mui/material';

export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <Slide direction="down" in={!online} mountOnEnter unmountOnExit>
      <Alert
        severity="warning"
        sx={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1400 }}
        data-tour="offline-indicator"
      >
        You are offline — some features may be unavailable.
      </Alert>
    </Slide>
  );
}
