/**
 * TrustVault Credential Parser
 *
 * Extracts credential fields (username, password, URL, notes) from raw OCR text.
 * Uses pattern matching and heuristic proximity detection for labeled fields.
 */

export interface ParsedCredential {
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  confidence: {
    username: number;
    password: number;
    url: number;
    notes: number;
    overall: number;
  };
}

// Patterns for field detection
const PATTERNS = {
  email: /[\w.+-]+@[\w.-]+\.\w{2,}/gi,
  url: /https?:\/\/[^\s]+|www\.[^\s]+/gi,
  usernameLabel:
    /\b(user\s*name|username|user|login|email|e-mail|account|id)\s*[:=]?\s*/gi,
  passwordLabel:
    /\b(pass\s*word|password|pass|pin|secret|key|pwd)\s*[:=]?\s*/gi,
  notesLabel: /\b(notes?|description|memo|comments?)\s*[:=]?\s*/gi,
};

/**
 * Extract value following a label pattern on the same or next line.
 */
function extractLabeledValue(
  lines: string[],
  labelPattern: RegExp,
  valuePattern?: RegExp
): { value: string; confidence: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const labelMatch = labelPattern.exec(line);

    if (labelMatch) {
      // Try same line after label
      const afterLabel = line.slice(labelMatch.index + labelMatch[0].length).trim();

      if (afterLabel.length > 0) {
        // If a specific value pattern is provided, validate against it
        if (valuePattern) {
          const valueMatch = afterLabel.match(valuePattern);
          if (valueMatch) {
            return { value: valueMatch[0], confidence: 0.9 };
          }
        } else if (afterLabel.length >= 3) {
          const firstWord = afterLabel.split(/\s+/)[0];
          return { value: firstWord ?? afterLabel, confidence: 0.85 };
        }
      }

      // Try next line
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && nextLine.length >= 3) {
        if (valuePattern) {
          const valueMatch = nextLine.match(valuePattern);
          if (valueMatch) {
            return { value: valueMatch[0], confidence: 0.75 };
          }
        }
        const firstWordNext = nextLine.split(/\s+/)[0];
        return { value: firstWordNext ?? nextLine, confidence: 0.7 };
      }
    }

    // Reset regex lastIndex for next iteration
    labelPattern.lastIndex = 0;
  }

  return null;
}

/**
 * Find standalone patterns (URLs, emails) without labels.
 */
function findStandalonePatterns(text: string): {
  emails: string[];
  urls: string[];
} {
  const emails: string[] = [];
  const urls: string[] = [];

  let match: RegExpExecArray | null;

  // Reset and find all emails
  PATTERNS.email.lastIndex = 0;
  while ((match = PATTERNS.email.exec(text)) !== null) {
    emails.push(match[0]);
  }

  // Reset and find all URLs
  PATTERNS.url.lastIndex = 0;
  while ((match = PATTERNS.url.exec(text)) !== null) {
    urls.push(match[0]);
  }

  return { emails, urls };
}

/**
 * Determine if a string looks like a password (mixed chars, no spaces, reasonable length).
 */
function looksLikePassword(value: string): boolean {
  if (value.length < 4 || value.length > 128) return false;
  if (/\s/.test(value)) return false;
  // Has mix of character types or special chars
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[^a-zA-Z0-9]/.test(value);
  const typeCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  return typeCount >= 2 || value.length >= 8;
}

/**
 * Parse OCR text into structured credential fields.
 */
export function parseCredentialText(text: string): ParsedCredential {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const fullText = lines.join('\n');

  const result: ParsedCredential = {
    confidence: {
      username: 0,
      password: 0,
      url: 0,
      notes: 0,
      overall: 0,
    },
  };

  // 1. Extract labeled username/email
  const usernameResult = extractLabeledValue(
    lines,
    new RegExp(PATTERNS.usernameLabel.source, 'gi'),
    PATTERNS.email
  );
  if (usernameResult) {
    result.username = usernameResult.value;
    result.confidence.username = usernameResult.confidence;
  }

  // 2. Fallback: standalone email
  if (!result.username) {
    const { emails } = findStandalonePatterns(fullText);
    const firstEmail = emails[0];
    if (firstEmail) {
      result.username = firstEmail;
      result.confidence.username = 0.6;
    }
  }

  // 3. Extract labeled password
  const passwordResult = extractLabeledValue(
    lines,
    new RegExp(PATTERNS.passwordLabel.source, 'gi')
  );
  if (passwordResult && looksLikePassword(passwordResult.value)) {
    result.password = passwordResult.value;
    result.confidence.password = passwordResult.confidence;
  }

  // 4. Extract URL
  const { urls } = findStandalonePatterns(fullText);
  const firstUrl = urls[0];
  if (firstUrl) {
    result.url = firstUrl;
    result.confidence.url = 0.8;
  }

  // 5. Extract notes (remaining meaningful text)
  const notesResult = extractLabeledValue(
    lines,
    new RegExp(PATTERNS.notesLabel.source, 'gi')
  );
  if (notesResult) {
    result.notes = notesResult.value;
    result.confidence.notes = notesResult.confidence;
  }

  // 6. Calculate overall confidence
  const confidences = [
    result.confidence.username,
    result.confidence.password,
    result.confidence.url,
  ].filter((c) => c > 0);
  result.confidence.overall =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  return result;
}

/**
 * Sanitize extracted values to remove common OCR artifacts.
 */
export function sanitizeValue(value: string): string {
  return value
    .replace(/[|\\[\]{}]/g, '') // Remove common OCR noise chars
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();
}
