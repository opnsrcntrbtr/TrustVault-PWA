/**
 * Password Strength Analyzer
 * Analyzes password strength using zxcvbn and custom checks
 */

import zxcvbn from 'zxcvbn';

export interface PasswordStrengthResult {
  score: number; // 0-100
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  entropy: number; // bits
  crackTime: string; // human-readable
  crackTimeSeconds: number;
  feedback: {
    warning: string;
    suggestions: string[];
  };
  weaknesses: string[];
}

/**
 * Common password patterns to check
 */
const COMMON_PATTERNS = [
  /^123+/,
  /^abc+/i,
  /qwerty/i,
  /password/i,
  /admin/i,
  /letmein/i,
  /welcome/i,
  /monkey/i,
  /dragon/i,
  /master/i,
  /^(.)\1+$/, // Repeated characters
];

/**
 * Check for common weak patterns
 */
function detectCommonPatterns(password: string): string[] {
  const weaknesses: string[] = [];

  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(password)) {
      weaknesses.push('Contains common pattern or dictionary word');
      break;
    }
  }

  // Check for keyboard patterns
  const keyboardPatterns = ['qwert', 'asdf', 'zxcv', '12345', '09876'];
  for (const pattern of keyboardPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      weaknesses.push('Contains keyboard pattern');
      break;
    }
  }

  // Check for date patterns (YYYY, MMDD, etc.)
  if (/19\d{2}|20\d{2}/.test(password)) {
    weaknesses.push('Contains year or date pattern');
  }

  // Check for repeated sequences
  if (/(.{2,})\1{2,}/.test(password)) {
    weaknesses.push('Contains repeated sequences');
  }

  return weaknesses;
}

/**
 * Calculate actual entropy based on character set usage
 */
function calculateActualEntropy(password: string): number {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  let charsetSize = 0;
  if (hasLowercase) charsetSize += 26;
  if (hasUppercase) charsetSize += 26;
  if (hasNumbers) charsetSize += 10;
  if (hasSymbols) charsetSize += 32; // Approximate

  if (charsetSize === 0) {
    return 0;
  }

  // Entropy = log2(charset_size^length)
  return Math.log2(Math.pow(charsetSize, password.length));
}

/**
 * Format crack time in human-readable format
 */
function formatCrackTime(seconds: number): string {
  if (seconds < 1) {
    return 'instant';
  } else if (seconds < 60) {
    const roundedSeconds = Math.round(seconds);
    return `${roundedSeconds} ${roundedSeconds === 1 ? 'second' : 'seconds'}`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  } else if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  } else if (seconds < 2592000) {
    const days = Math.round(seconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  } else if (seconds < 31536000) {
    const months = Math.round(seconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  } else if (seconds < 3153600000) {
    const years = Math.round(seconds / 31536000);
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  } else {
    return 'centuries';
  }
}

/**
 * Convert zxcvbn score (0-4) to our score (0-100)
 */
function convertZxcvbnScore(zxcvbnScore: number): number {
  // zxcvbn: 0 = weak, 1 = weak, 2 = medium, 3 = strong, 4 = very strong
  const scoreMap: { [key: number]: number } = {
    0: 20,  // weak
    1: 40,  // weak
    2: 60,  // medium
    3: 80,  // strong
    4: 95,  // very strong
  };
  return scoreMap[zxcvbnScore] ?? 20;
}

/**
 * Determine strength level from score
 */
function determineStrength(score: number): 'weak' | 'medium' | 'strong' | 'very-strong' {
  if (score < 40) {
    return 'weak';
  } else if (score < 60) {
    return 'medium';
  } else if (score < 80) {
    return 'strong';
  } else {
    return 'very-strong';
  }
}

/**
 * Analyze password strength
 */
export function analyzePasswordStrength(password: string): PasswordStrengthResult {
  if (!password || password.length === 0) {
    return {
      score: 0,
      strength: 'weak',
      entropy: 0,
      crackTime: 'instant',
      crackTimeSeconds: 0,
      feedback: {
        warning: 'Password is empty',
        suggestions: ['Enter a password'],
      },
      weaknesses: ['Password is empty'],
    };
  }

  // Use zxcvbn for detailed analysis
  const result = zxcvbn(password);

  // Detect custom weaknesses
  const weaknesses: string[] = [
    ...detectCommonPatterns(password),
  ];

  // Add length-based weaknesses
  if (password.length < 8) {
    weaknesses.push('Password is too short (minimum 8 characters)');
  }

  // Check character diversity
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  let diversityCount = 0;
  if (hasLowercase) diversityCount++;
  if (hasUppercase) diversityCount++;
  if (hasNumbers) diversityCount++;
  if (hasSymbols) diversityCount++;

  if (diversityCount < 3) {
    weaknesses.push('Password lacks character diversity');
  }

  // Calculate actual entropy
  const entropy = calculateActualEntropy(password);

  // Get crack time from zxcvbn (online attack, 10/sec)
  // zxcvbn can return string | number, so we ensure it's a number
  const rawCrackTime = result.crack_times_seconds.online_no_throttling_10_per_second;
  const crackTimeSeconds = typeof rawCrackTime === 'string' ? parseFloat(rawCrackTime) : rawCrackTime;
  const crackTime = formatCrackTime(crackTimeSeconds);

  // Calculate final score
  const baseScore = convertZxcvbnScore(result.score);

  // Adjust score based on weaknesses
  const weaknessPenalty = Math.min(weaknesses.length * 10, 40);
  const finalScore = Math.max(0, baseScore - weaknessPenalty);

  // Build feedback
  const feedback = {
    warning: result.feedback.warning || '',
    suggestions: [
      ...result.feedback.suggestions,
      ...(weaknesses.length > 0 ? ['Avoid common patterns and increase complexity'] : []),
    ],
  };

  return {
    score: finalScore,
    strength: determineStrength(finalScore),
    entropy: Math.round(entropy * 10) / 10,
    crackTime,
    crackTimeSeconds,
    feedback,
    weaknesses,
  };
}

/**
 * Quick strength check (without zxcvbn)
 * Useful for real-time feedback while typing
 */
export function quickStrengthCheck(password: string): {
  score: number;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  if (!password) {
    return { score: 0, strength: 'weak' };
  }

  let score = 0;

  // Length scoring (max 40 points)
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  // Character diversity (max 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  // No common patterns (max 20 points)
  let hasCommonPattern = false;
  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(password)) {
      hasCommonPattern = true;
      break;
    }
  }
  if (!hasCommonPattern) score += 20;

  const strength = determineStrength(score);

  return { score, strength };
}

/**
 * Check if password meets minimum requirements
 */
export function meetsMinimumRequirements(password: string): {
  meets: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (password.length < 8) {
    missing.push('At least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    missing.push('One lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    missing.push('One uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    missing.push('One number');
  }

  return {
    meets: missing.length === 0,
    missing,
  };
}
