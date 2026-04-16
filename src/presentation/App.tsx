/**
 * Main App Component
 * Root component with theme provider and routing
 */

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createAppTheme } from './theme/theme';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { initializeDatabase } from '@/data/storage/database';
import { Box, CircularProgress } from '@mui/material';
import { useAutoLock, getDefaultAutoLockConfig } from './hooks/useAutoLock';
import ClipboardNotification from './components/ClipboardNotification';
import MobileNavigation from './components/MobileNavigation';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import UpdateNotification from './components/UpdateNotification';
import CryptoAPIError from './components/CryptoAPIError';
import { initPerformanceMonitoring } from './utils/performance';
import { prefetchTesseractAssets } from '@/core/ocr';
import OnboardingTour from '@/components/OnboardingTour';
import '@/styles/driver-custom.css';

// Lazy load page components for code splitting
const SigninPage = lazy(() => import('./pages/SigninPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AddCredentialPage = lazy(() => import('./pages/AddCredentialPage'));
const EditCredentialPage = lazy(() => import('./pages/EditCredentialPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SecurityAuditPage = lazy(() => import('./pages/SecurityAuditPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const UnlockPage = lazy(() => import('./pages/UnlockPage'));
const PasswordGeneratorPage = lazy(() => import('./pages/PasswordGeneratorPage'));

// Loading fallback component
function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function AppRoutes() {
  const { user, isAuthenticated, isLocked, vaultKey, lockVault } = useAuthStore();

  // Setup auto-lock with user's security settings (must be inside BrowserRouter)
  const autoLockConfig = useMemo(
    () => getDefaultAutoLockConfig(user?.securitySettings?.sessionTimeoutMinutes),
    [user?.securitySettings?.sessionTimeoutMinutes]
  );
  useAutoLock(autoLockConfig);

  // Auto-lock vault when user is authenticated but vaultKey is missing (e.g., after page refresh)
  // The vaultKey cannot be persisted (CryptoKey is not serializable), so we need to redirect to unlock
  useEffect(() => {
    if (isAuthenticated && !isLocked && !vaultKey) {
      console.log('[AppRoutes] Detected authenticated user without vault key, locking vault');
      lockVault();
    }
  }, [isAuthenticated, isLocked, vaultKey, lockVault]);

  // Consider vault locked if no vault key is available (even if isLocked is false)
  const effectivelyLocked = isLocked || (isAuthenticated && !vaultKey);

  return (
    <>
      {/* Global components */}
      <ClipboardNotification />
      <MobileNavigation />

      {/* Onboarding tour - only for authenticated users with vault unlocked */}
      {isAuthenticated && !effectivelyLocked && <OnboardingTour autoStart delay={1500} />}
      
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* Signin route */}
        <Route
          path="/signin"
          element={!isAuthenticated ? <SigninPage /> : <Navigate to="/dashboard" replace />}
        />

        {/* Signup route */}
        <Route
          path="/signup"
          element={!isAuthenticated ? <SignupPage /> : <Navigate to="/dashboard" replace />}
        />

        {/* Unlock route - shown when authenticated but locked */}
        <Route
          path="/unlock"
          element={
            isAuthenticated && effectivelyLocked ? (
              <UnlockPage />
            ) : isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Dashboard route */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <DashboardPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Add Credential route */}
        <Route
          path="/credentials/add"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <AddCredentialPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Edit Credential route */}
        <Route
          path="/credentials/:id/edit"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <EditCredentialPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Settings route */}
        <Route
          path="/settings"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <SettingsPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Security Audit route */}
        <Route
          path="/security-audit"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <SecurityAuditPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Favorites route */}
        <Route
          path="/favorites"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <FavoritesPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Password Generator route */}
        <Route
          path="/password-generator"
          element={
            isAuthenticated && !effectivelyLocked ? (
              <Box sx={{ pb: { xs: 8, md: 0 } }}>
                <PasswordGeneratorPage />
              </Box>
            ) : isAuthenticated && effectivelyLocked ? (
              <Navigate to="/unlock" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        {/* Legacy /login redirect to /signin */}
        <Route path="/login" element={<Navigate to="/signin" replace />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/signin"} replace />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

function AppContent() {
  const { isAuthenticated, isLocked } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [cryptoAPIAvailable, setCryptoAPIAvailable] = useState<boolean | null>(null);

  // Check if Web Crypto API is available (required for encryption)
  useEffect(() => {
    const isAvailable = typeof crypto !== 'undefined' && !!crypto.subtle;
    setCryptoAPIAvailable(isAvailable);

    if (!isAvailable) {
      console.error('Web Crypto API not available. HTTPS or localhost required.');
    }
  }, []);

  // Initialize performance monitoring (development only)
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  // Prefetch Tesseract OCR assets on idle for faster first-scan UX
  useEffect(() => {
    if (!isInitialized) return;

    // Use requestIdleCallback to prefetch during browser idle time
    const prefetch = () => {
      prefetchTesseractAssets().catch(() => {
        // Best-effort; ignore failures
      });
    };

    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 5000 });
      return () => { window.cancelIdleCallback(handle); };
    } else {
      // Fallback for Safari: use setTimeout with delay
      const handle = setTimeout(prefetch, 3000);
      return () => { clearTimeout(handle); };
    }
  }, [isInitialized]);

  useEffect(() => {
    console.log('App mounted, initializing database...');

    let mounted = true;
    let hasCompleted = false;

    const completeInitialization = (source: string) => {
      if (mounted && !hasCompleted) {
        hasCompleted = true;
        console.log(`Database initialization completed via ${source}`);
        setIsInitialized(true);
      }
    };

    // Initialize database with a timeout (2 seconds max)
    const initTimeout = setTimeout(() => {
      console.warn('Database initialization timeout - proceeding without persistence');
      completeInitialization('timeout');
    }, 2000);

    // Try to initialize database
    initializeDatabase()
      .then(() => {
        clearTimeout(initTimeout);
        completeInitialization('success');
      })
      .catch((error) => {
        console.error('Database initialization error:', error);
        clearTimeout(initTimeout);
        completeInitialization('error');
      });

    // Cleanup
    return () => {
      mounted = false;
      clearTimeout(initTimeout);
    };
  }, []);

  console.log('App rendering - isAuthenticated:', isAuthenticated, 'isLocked:', isLocked, 'isInitialized:', isInitialized, 'cryptoAPIAvailable:', cryptoAPIAvailable);

  // Show error if crypto API not available
  if (cryptoAPIAvailable === false) {
    return <CryptoAPIError currentUrl={window.location.href} />;
  }

  // Show loading while checking crypto API
  if (cryptoAPIAvailable === null) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#121212',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isInitialized) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#121212',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Box sx={{ color: 'white', textAlign: 'center' }}>
          <div>Initializing TrustVault...</div>
        </Box>
      </Box>
    );
  }

  // Get base path for routing
  // Vercel uses root path '/', GitHub Pages uses '/TrustVault-PWA/'
  // Check if we're on Vercel by looking for vercel.app domain
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  const basename = import.meta.env.PROD && !isVercel ? '/TrustVault-PWA' : '';

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', flexDirection: 'column' }}>
      <BrowserRouter basename={basename}>
        <AppRoutes />
        {/* PWA helpers */}
        <InstallPrompt />
        <OfflineIndicator />
        <UpdateNotification />
      </BrowserRouter>
    </div>
  );
}

function App() {
  const { mode } = useThemeStore();

  // Create theme based on current mode
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  );
}

export default App;