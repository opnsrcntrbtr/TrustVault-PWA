/**
 * Mobile Navigation Component
 * Bottom navigation bar for mobile devices (<768px)
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  VpnKey as VpnKeyIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export default function MobileNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 0;
    if (path === '/generator') return 1;
    if (path === '/settings') return 2;
    return 0;
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/dashboard');
        break;
      case 1:
        // Navigate to standalone generator page (create if needed) or open dialog
        navigate('/dashboard'); // For now, stay on dashboard
        break;
      case 2:
        navigate('/settings');
        break;
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: { xs: 'block', md: 'none' }, // Only show on mobile
      }}
      elevation={3}
    >
      <BottomNavigation value={getActiveTab()} onChange={handleChange} showLabels>
        <BottomNavigationAction label="Credentials" icon={<DashboardIcon />} />
        <BottomNavigationAction label="Generator" icon={<VpnKeyIcon />} />
        <BottomNavigationAction label="Settings" icon={<SettingsIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
