/**
 * Password Hashing Service
 * Uses scrypt for secure password hashing (from @noble/hashes)
 * OWASP compliant password hashing with memory-hard algorithm
 */

import { scrypt } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import zxcvbn from 'zxcvbn';

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
  const result = zxcvbn(password);

  const strengthMap: Record<number, 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong'> = {
    0: 'very_weak',
    1: 'weak',
    2: 'fair',
    3: 'strong',
    4: 'very_strong',
  };

  const feedback: string[] = [];
  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }
  feedback.push(...result.feedback.suggestions);

  return {
    score: result.score * 25,
    feedback,
    strength: strengthMap[result.score] ?? 'very_weak',
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

  const sets = [
    lowercase ? 'abcdefghijklmnopqrstuvwxyz' : '',
    uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '',
    numbers ? '0123456789' : '',
    symbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '',
  ]
    .filter((set) => set.length > 0)
    .map((set) => excludeAmbiguous ? removeAmbiguousCharacters(set) : set)
    .filter((set) => set.length > 0);

  if (sets.length === 0) {
    throw new Error('At least one character set must be selected');
  }

  const targetLength = Math.max(length, sets.length);
  const allCharacters = sets.join('');
  const requiredCharacters = sets.map((set) => getRandomCharacter(set));
  const remainingCharacters = Array.from({ length: targetLength - requiredCharacters.length }, () =>
    getRandomCharacter(allCharacters)
  );

  return shuffleCharacters([...requiredCharacters, ...remainingCharacters]).join('');
}

/**
 * Generates a memorable passphrase using diceware method
 */
export function generatePassphrase(wordCount: number = 6): string {
  const validWordCount = Math.max(4, Math.min(8, wordCount));
  const words = Array.from({ length: validWordCount }, () => {
    const word = PASSPHRASE_WORDS[getRandomInt(PASSPHRASE_WORDS.length)] ?? 'vault';
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  const suffix = String(getRandomInt(90) + 10);

  return `${words.join('-')}-${suffix}`;
}

function removeAmbiguousCharacters(characters: string): string {
  return characters.replace(/[0O1Il|]/g, '');
}

function getRandomCharacter(characters: string): string {
  return characters[getRandomInt(characters.length)] ?? characters[0] ?? '';
}

function getRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error('maxExclusive must be positive');
  }

  const randomValues = new Uint32Array(1);
  const maxUnbiased = Math.floor(0x100000000 / maxExclusive) * maxExclusive;

  let value = 0;
  do {
    crypto.getRandomValues(randomValues);
    value = randomValues[0] ?? 0;
  } while (value >= maxUnbiased);

  return value % maxExclusive;
}

function shuffleCharacters(characters: string[]): string[] {
  const shuffled = [...characters];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = getRandomInt(index + 1);
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (current === undefined || swap === undefined) {
      continue;
    }
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

const PASSPHRASE_WORDS = [
  'anchor',
  'beacon',
  'canyon',
  'delta',
  'ember',
  'forest',
  'harbor',
  'island',
  'jigsaw',
  'keystone',
  'lantern',
  'meadow',
  'nebula',
  'onyx',
  'prairie',
  'quartz',
  'river',
  'summit',
  'thunder',
  'uplift',
  'velvet',
  'willow',
  'xenon',
  'yonder',
  'zenith',
];
