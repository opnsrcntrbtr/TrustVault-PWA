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
 * Common top-level domains used to repair OCR-mangled email domains
 * (e.g. a dropped dot: "gmailcom" → "gmail.com").
 */
const KNOWN_TLDS = [
  'com',
  'net',
  'org',
  'edu',
  'gov',
  'info',
  'io',
  'co',
  'us',
  'uk',
  'in',
];

/**
 * Repair an OCR-mangled email into a valid address, or return null.
 *
 * OCR of low-contrast / italic form text routinely (a) inserts spurious
 * spaces inside the address, (b) drops the dot before the TLD, and
 * (c) misreads ".com" as ".con"/".corn". This normalizes those artifacts
 * BEFORE the strict email regex runs, so a genuine address isn't discarded
 * (and replaced by a single garbage token — the "i" bug).
 */
export function normalizeOcrEmail(text: string): string | null {
  if (!text.includes('@')) return null;

  // OCR sprays spurious whitespace through the token; an email never
  // legitimately contains spaces, so strip them all.
  let s = text.replace(/\s+/g, '');

  // Common TLD misreads.
  s = s.replace(/\.con\b/gi, '.com').replace(/\.corn\b/gi, '.com');

  // Repair a missing dot before a known TLD: "gmailcom" → "gmail.com".
  const atIdx = s.indexOf('@');
  const local = s.slice(0, atIdx);
  let domain = s.slice(atIdx + 1);
  if (!domain.includes('.')) {
    const lower = domain.toLowerCase();
    for (const tld of KNOWN_TLDS) {
      if (lower.endsWith(tld) && domain.length > tld.length) {
        domain = `${domain.slice(0, -tld.length)}.${domain.slice(-tld.length)}`;
        break;
      }
    }
  }
  s = `${local}@${domain}`;

  const match = s.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  return match ? match[0] : null;
}

/**
 * Extract value following a label pattern on the same or next line.
 *
 * When `valuePattern` is supplied, the value MUST satisfy it (optionally after
 * `normalize` repair). If it cannot, we return nothing rather than emitting the
 * first whitespace token — a bare token like "i" is worse than no detection.
 */
function extractLabeledValue(
  lines: string[],
  labelPattern: RegExp,
  valuePattern?: RegExp,
  normalize?: (s: string) => string | null
): { value: string; confidence: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    labelPattern.lastIndex = 0;
    const labelMatch = labelPattern.exec(line);

    if (labelMatch) {
      const afterLabel = line
        .slice(labelMatch.index + labelMatch[0].length)
        .trim();
      const nextLine = lines[i + 1]?.trim() ?? '';

      // Same line gets higher confidence than the next line.
      const candidates: { text: string; matched: number; firstWord: number }[] =
        [
          { text: afterLabel, matched: 0.9, firstWord: 0.85 },
          { text: nextLine, matched: 0.75, firstWord: 0.7 },
        ];

      for (const c of candidates) {
        if (c.text.length === 0) continue;

        if (valuePattern) {
          // Normalize first: a raw regex match can latch onto a substring
          // (e.g. "i anpinto…@…" → "anpinto…@…", dropping the leading char).
          if (normalize) {
            const repaired = normalize(c.text);
            const repairedMatch = repaired?.match(valuePattern);
            if (repaired && repairedMatch) {
              return { value: repairedMatch[0], confidence: c.matched - 0.05 };
            }
          }
          const direct = c.text.match(valuePattern);
          if (direct) {
            return { value: direct[0], confidence: c.matched };
          }
          // Required pattern unmet — do NOT emit a garbage token.
          continue;
        }

        // No value pattern (free-form fields): take the first token.
        if (c.text.length >= 3) {
          const firstWord = c.text.split(/\s+/)[0];
          return { value: firstWord ?? c.text, confidence: c.firstWord };
        }
      }
    }

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
    PATTERNS.email,
    normalizeOcrEmail
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
