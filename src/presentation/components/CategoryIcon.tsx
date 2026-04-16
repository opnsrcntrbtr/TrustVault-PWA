/**
 * Category Icon Component
 * Displays category-specific icons with color coding
 */

import { Avatar, SvgIconProps } from '@mui/material';
import {
  Lock,
  CreditCard,
  AccountBalance,
  Person,
  Code,
  Key,
  Note,
} from '@mui/icons-material';
import type { CredentialCategory } from '@/domain/entities/Credential';

interface CategoryIconProps {
  category: CredentialCategory;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Get the icon component for a category
 */
export function getCategoryIcon(category: CredentialCategory): React.ReactElement<SvgIconProps> {
  switch (category) {
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
}

/**
 * Get the color for a category
 */
export function getCategoryColor(category: CredentialCategory): string {
  switch (category) {
    case 'login':
      return '#2196F3'; // Blue
    case 'credit_card':
      return '#4CAF50'; // Green
    case 'bank_account':
      return '#009688'; // Teal
    case 'identity':
      return '#9C27B0'; // Purple
    case 'api_key':
      return '#FF9800'; // Orange
    case 'ssh_key':
      return '#FF5722'; // Deep Orange
    case 'secure_note':
      return '#607D8B'; // Blue Grey
    default:
      return '#2196F3';
  }
}

/**
 * Get category display name
 */
export function getCategoryName(category: CredentialCategory): string {
  switch (category) {
    case 'login':
      return 'Login';
    case 'credit_card':
      return 'Credit Card';
    case 'bank_account':
      return 'Bank Account';
    case 'identity':
      return 'Identity';
    case 'api_key':
      return 'API Key';
    case 'ssh_key':
      return 'SSH Key';
    case 'secure_note':
      return 'Secure Note';
    default:
      return 'Login';
  }
}

export default function CategoryIcon({ category, size = 'medium' }: CategoryIconProps) {
  const iconSize = size === 'small' ? 32 : size === 'large' ? 56 : 40;

  return (
    <Avatar
      sx={{
        width: iconSize,
        height: iconSize,
        backgroundColor: getCategoryColor(category),
      }}
    >
      {getCategoryIcon(category)}
    </Avatar>
  );
}
