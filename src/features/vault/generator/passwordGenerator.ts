/**
 * Password Generator Service
 * Cryptographically secure password generation using Web Crypto API
 */

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean;
  customCharset?: string;
}

export interface GeneratedPassword {
  password: string;
  entropy: number;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
}

// Character sets
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// Ambiguous characters to exclude (characters that look similar and cause confusion)
// 0/O/o, 1/l/I/i/|
const AMBIGUOUS_CHARS = '0Oo1lIi|';

/**
 * Get cryptographically secure random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Get random integer in range [0, max) using crypto API
 * Uses rejection sampling to avoid modulo bias
 */
function getRandomInt(max: number): number {
  if (max <= 0) {
    throw new Error('Max must be positive');
  }

  // Calculate the largest multiple of max that fits in 256
  const limit = Math.floor(256 / max) * max;

  // Keep trying until we get a value in the acceptable range
  let value: number;
  do {
    value = getRandomBytes(1)[0] ?? 0;
  } while (value >= limit);

  return value % max;
}

/**
 * Build charset based on options
 */
function buildCharset(options: PasswordGeneratorOptions): string {
  if (options.customCharset) {
    return options.customCharset;
  }

  let charset = '';

  if (options.includeUppercase) {
    charset += UPPERCASE;
  }
  if (options.includeLowercase) {
    charset += LOWERCASE;
  }
  if (options.includeNumbers) {
    charset += NUMBERS;
  }
  if (options.includeSymbols) {
    charset += SYMBOLS;
  }

  // Exclude ambiguous characters if requested
  if (options.excludeAmbiguous && charset.length > 0) {
    charset = charset.split('').filter(char => !AMBIGUOUS_CHARS.includes(char)).join('');
  }

  return charset;
}

/**
 * Calculate password entropy in bits
 * Entropy = log2(charset_size^length)
 */
function calculateEntropy(charsetSize: number, length: number): number {
  if (charsetSize === 0 || length === 0) {
    return 0;
  }
  return Math.log2(Math.pow(charsetSize, length));
}

/**
 * Determine strength level based on entropy
 * - weak: < 40 bits
 * - medium: 40-59 bits
 * - strong: 60-79 bits
 * - very-strong: >= 80 bits
 */
function determineStrength(entropy: number): 'weak' | 'medium' | 'strong' | 'very-strong' {
  if (entropy < 40) {
    return 'weak';
  } else if (entropy < 60) {
    return 'medium';
  } else if (entropy < 80) {
    return 'strong';
  } else {
    return 'very-strong';
  }
}

/**
 * Validate password generation options
 */
function validateOptions(options: PasswordGeneratorOptions): void {
  if (options.length < 8 || options.length > 128) {
    throw new Error('Password length must be between 8 and 128 characters');
  }

  const charset = buildCharset(options);
  if (charset.length === 0) {
    throw new Error('At least one character set must be selected');
  }

  // Ensure minimum charset size for security
  if (charset.length < 4 && !options.customCharset) {
    throw new Error('Character set too small. Enable more character types.');
  }
}

/**
 * Ensure password includes at least one character from each selected set
 */
function ensureCharacterDiversity(
  password: string,
  options: PasswordGeneratorOptions
): boolean {
  if (options.includeUppercase && !/[A-Z]/.test(password)) {
    return false;
  }
  if (options.includeLowercase && !/[a-z]/.test(password)) {
    return false;
  }
  if (options.includeNumbers && !/[0-9]/.test(password)) {
    return false;
  }
  if (options.includeSymbols && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    return false;
  }
  return true;
}

/**
 * Generate a cryptographically secure random password
 */
export function generatePassword(options: PasswordGeneratorOptions): GeneratedPassword {
  // Validate options
  validateOptions(options);

  const charset = buildCharset(options);
  const charsetSize = charset.length;

  // Generate password
  let password = '';
  let attempts = 0;
  const maxAttempts = 100;

  // Keep generating until we have a password with proper character diversity
  do {
    password = '';
    for (let i = 0; i < options.length; i++) {
      const randomIndex = getRandomInt(charsetSize);
      const char = charset[randomIndex];
      if (char) {
        password += char;
      }
    }
    attempts++;
  } while (!ensureCharacterDiversity(password, options) && attempts < maxAttempts);

  // Calculate entropy
  const entropy = calculateEntropy(charsetSize, options.length);

  // Determine strength
  const strength = determineStrength(entropy);

  return {
    password,
    entropy: Math.round(entropy * 10) / 10, // Round to 1 decimal place
    strength
  };
}

/**
 * Generate multiple passwords at once
 */
export function generatePasswords(
  count: number,
  options: PasswordGeneratorOptions
): GeneratedPassword[] {
  if (count < 1 || count > 100) {
    throw new Error('Count must be between 1 and 100');
  }

  const passwords: GeneratedPassword[] = [];
  for (let i = 0; i < count; i++) {
    passwords.push(generatePassword(options));
  }
  return passwords;
}

/**
 * Get default password generator options
 */
export function getDefaultOptions(): PasswordGeneratorOptions {
  return {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: false,
  };
}

/**
 * Generate a pronounceable password
 * Uses alternating consonants and vowels pattern
 */
export function generatePronounceablePassword(length: number): GeneratedPassword {
  if (length < 8 || length > 128) {
    throw new Error('Length must be between 8 and 128');
  }

  const consonants = 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiou';
  const numbers = '0123456789';

  let password = '';

  // Generate pattern: consonant-vowel-consonant-vowel...
  for (let i = 0; i < length; i++) {
    if (i % 4 === 3) {
      // Every 4th character is a number for variety
      const char = numbers[getRandomInt(numbers.length)];
      if (char) password += char;
    } else if (i % 2 === 0) {
      // Even positions: consonants
      const char = consonants[getRandomInt(consonants.length)];
      if (char) password += char;
    } else {
      // Odd positions: vowels
      const char = vowels[getRandomInt(vowels.length)];
      if (char) password += char;
    }
  }

  // Capitalize random positions
  const chars = password.split('');
  const capitalizeCount = Math.floor(length / 4);
  for (let i = 0; i < capitalizeCount; i++) {
    const pos = getRandomInt(length);
    const char = chars[pos];
    if (char) {
      chars[pos] = char.toUpperCase();
    }
  }
  password = chars.join('');

  // Calculate entropy (approximation for pronounceable passwords)
  const entropy = calculateEntropy(20, length); // Approximation
  const strength = determineStrength(entropy);

  return { password, entropy, strength };
}
