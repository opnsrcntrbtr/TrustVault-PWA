import { useEffect, useState } from 'react';
import { Button, Snackbar } from '@mui/material';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      // @ts-ignore - non-standard event
      e.preventDefault();
      // @ts-ignore
      setDeferredPrompt(e);
      setOpen(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall as EventListener);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      // @ts-ignore
      deferredPrompt.prompt();
      // @ts-ignore
      const choice = await deferredPrompt.userChoice;
      setOpen(false);
      setDeferredPrompt(null);
      // choice.outcome is 'accepted' or 'dismissed'
      // We intentionally don't force a reload
    } catch (e) {
      setOpen(false);
    }
  };

  return (
    <Snackbar
      open={open}
      message="Install TrustVault for quick access"
      action={
        <Button
          color="inherit"
          size="small"
          onClick={handleInstall}
          data-tour="install-button"
        >
          Install
        </Button>
      }
      onClose={() => { setOpen(false); }}
    />
  );
}
