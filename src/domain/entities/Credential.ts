/**
 * Domain Entity: Credential
 * Represents a securely stored credential with encrypted data
 */
export interface Credential {
  id: string;
  title: string;
  username: string;
  password: string; // Decrypted password (plain text in memory only)
  url?: string | undefined;
  notes?: string | undefined;
  category: CredentialCategory;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date | undefined;
  isFavorite: boolean;
  securityScore?: number | undefined; // 0-100 based on password strength
  totpSecret?: string | undefined; // TOTP/2FA secret (base32-encoded, decrypted in memory)

  // Card-specific fields (for credit_card category)
  cardNumber?: string | undefined; // Full card number (decrypted in memory)
  cardholderName?: string | undefined;
  expiryMonth?: string | undefined; // MM format
  expiryYear?: string | undefined; // YYYY format
  cvv?: string | undefined; // Security code (decrypted in memory)
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other' | undefined;
  billingAddress?: string | undefined;
}

export type CredentialCategory = 
  | 'login'
  | 'credit_card'
  | 'bank_account'
  | 'secure_note'
  | 'identity'
  | 'api_key'
  | 'ssh_key';

export interface CredentialInput {
  title: string;
  username: string;
  password: string; // Plain text - will be encrypted before storage
  url?: string | undefined;
  notes?: string | undefined;
  category: CredentialCategory;
  tags?: string[];
  isFavorite?: boolean;
  totpSecret?: string | undefined; // TOTP/2FA secret (base32-encoded) - will be encrypted before storage

  // Card-specific fields (for credit_card category)
  cardNumber?: string | undefined;
  cardholderName?: string | undefined;
  expiryMonth?: string | undefined;
  expiryYear?: string | undefined;
  cvv?: string | undefined;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other' | undefined;
  billingAddress?: string | undefined;
}
