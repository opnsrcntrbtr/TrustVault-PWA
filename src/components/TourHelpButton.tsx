/**
 * TourHelpButton Component
 * Help button to restart onboarding tour
 */

import { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  HelpOutline,
  PlayCircleOutline,
  Security,
  Dashboard,
  VpnKey,
  FileDownload,
  Fingerprint,
  InstallMobile,
} from '@mui/icons-material';
import { useDriverTour } from '@/hooks/useDriverTour';

/**
 * TourHelpButton Component
 */
export default function TourHelpButton() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const {
    startFirstTimeTour,
    startDashboardTour,
    startSecurityTour,
    startCredentialsTour,
    startExportTour,
    startBiometricTour,
    startPWAInstallTour,
  } = useDriverTour();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTourSelect = (tourFunction: () => void) => {
    handleClose();
    // Small delay to allow menu to close smoothly
    setTimeout(tourFunction, 100);
  };

  return (
    <>
      <Tooltip title="Help & Tours">
        <IconButton
          color="inherit"
          onClick={handleClick}
          aria-label="help and tours"
          aria-controls={open ? 'tour-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <HelpOutline />
        </IconButton>
      </Tooltip>

      <Menu
        id="tour-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            'aria-labelledby': 'help-button',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleTourSelect(startFirstTimeTour); }}>
          <ListItemIcon>
            <PlayCircleOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Getting Started Tour" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startDashboardTour); }}>
          <ListItemIcon>
            <Dashboard fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Dashboard Features" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startSecurityTour); }}>
          <ListItemIcon>
            <Security fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Security Features" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startCredentialsTour); }}>
          <ListItemIcon>
            <VpnKey fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Managing Credentials" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startExportTour); }}>
          <ListItemIcon>
            <FileDownload fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Export & Backup" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startBiometricTour); }}>
          <ListItemIcon>
            <Fingerprint fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Biometric Setup" />
        </MenuItem>

        <MenuItem onClick={() => { handleTourSelect(startPWAInstallTour); }}>
          <ListItemIcon>
            <InstallMobile fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Install as App" />
        </MenuItem>
      </Menu>
    </>
  );
}
