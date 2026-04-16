import { useEffect, useState } from 'react';
import { Button, Snackbar } from '@mui/material';

export default function UpdateAvailableSnackbar() {
  const [open, setOpen] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      // If there's a waiting SW, an update is available
      if (reg.waiting) {
        setOpen(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && reg.waiting) {
            setOpen(true);
          }
        });
      });
    });

    // Reload when the new service worker has taken control
    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      try {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const handleRefresh = () => {
    if (!registration) return;
    // Tell SW to skip waiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <Snackbar
      open={open}
      message="A new version is available"
      action={<Button color="inherit" size="small" onClick={handleRefresh}>Update</Button>}
      onClose={() => { setOpen(false); }}
    />
  );
}
