/**
 * Password Hashing Service
 * Uses scrypt for secure password hashing (from @noble/hashes)
 * OWASP compliant password hashing with memory-hard algorithm
 */

import { scrypt } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import { analyzePasswordStrength as advancedAnalyzer } from '@/features/vault/generator/strengthAnalyzer';
import { generatePassword } from '@/features/vault/generator/passwordGenerator';
import { generatePassphrase as advancedPassphraseGenerator } from '@/features/vault/generator/passphraseGenerator';

// Scrypt parameters (OWASP recommended for password hashing)
const SCRYPT_CONFIG = {
  N: 32768, // CPU/memory cost parameter (2^15)
  r: 8,     // Block size parameter
  p: 1,     // Parallelization parameter
  dkLen: 32 // Derived key length in bytes
};

export interface HashedPassword {
  hash: string; // Encoded hash with parameters
  salt: string; // Base64 encoded salt
}

/**
 * Hashes a password using scrypt
 * Returns the hash in a custom encoded format: scrypt$N$r$p$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Generate random salt (16 bytes)
    const salt = randomBytes(16);

    // Hash password with scrypt
    const hash = scrypt(password, salt, SCRYPT_CONFIG);

    // Encode to base64
    const saltB64 = btoa(String.fromCharCode(...salt));
    const hashB64 = btoa(String.fromCharCode(...hash));

    // Return in PHC-like format
    return `scrypt$${SCRYPT_CONFIG.N}$${SCRYPT_CONFIG.r}$${SCRYPT_CONFIG.p}$${saltB64}$${hashB64}`;
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verifies a password against a scrypt hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    console.log('Verifying password...');

    // Parse the hash format: scrypt$N$r$p$salt$hash
    const parts = hashedPassword.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      console.error('Invalid hash format. Expected scrypt hash but got:', hashedPassword.substring(0, 50));
      console.error('This might be an old argon2 hash. Please clear the database using: window.debugDB.clearAllData()');
      return false;
    }

    const N = parseInt(parts[1] || '0', 10);
    const r = parseInt(parts[2] || '0', 10);
    const p = parseInt(parts[3] || '0', 10);
    const saltB64 = parts[4] || '';
    const hashB64 = parts[5] || '';

    // Decode salt and hash
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));

    // Hash the provided password with the same parameters
    const actualHash = scrypt(password, salt, { N, r, p, dkLen: expectedHash.length });

    // Constant-time comparison
    let match = true;
    for (let i = 0; i < expectedHash.length; i++) {
      if (expectedHash[i] !== actualHash[i]) {
        match = false;
      }
    }

    console.log('Password verification result:', match);
    return match;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Analyzes password strength using comprehensive zxcvbn-based analysis
 * Returns a score from 0 to 100
 */
export function analyzePasswordStrength(password: string): {
  score: number;
  feedback: string[];
  strength: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
} {
  const result = advancedAnalyzer(password);

  // Map the new strength format to the old format for backward compatibility
  const strengthMap: Record<string, 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong'> = {
    'weak': 'weak',
    'medium': 'fair',
    'strong': 'strong',
    'very-strong': 'very_strong',
  };

  // Build feedback array from new format
  const feedback: string[] = [];
  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }
  feedback.push(...result.feedback.suggestions);

  // Add weaknesses to feedback
  feedback.push(...result.weaknesses);

  return {
    score: result.score,
    feedback,
    strength: strengthMap[result.strength] || 'weak',
  };
}

/**
 * Generates a cryptographically secure random password using advanced generator
 */
export function generateSecurePassword(
  length: number = 20,
  options: {
    lowercase?: boolean;
    uppercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
    excludeAmbiguous?: boolean;
  } = {}
): string {
  const {
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = true,
    excludeAmbiguous = false,
  } = options;

  // Use the advanced generator with the provided options
  const result = generatePassword({
    length,
    includeUppercase: uppercase,
    includeLowercase: lowercase,
    includeNumbers: numbers,
    includeSymbols: symbols,
    excludeAmbiguous,
  });

  return result.password;
}

/**
 * Generates a memorable passphrase using diceware method
 */
export function generatePassphrase(wordCount: number = 6): string {
  // Clamp word count to valid range (4-8)
  const validWordCount = Math.max(4, Math.min(8, wordCount));

  // Use the advanced generator with default options
  const result = advancedPassphraseGenerator({
    wordCount: validWordCount,
    separator: 'dash',
    capitalize: 'first',
    includeNumbers: true,
  });

  return result.password;
}
