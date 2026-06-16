/**
 * Sanitizes a URL to prevent protocol-based XSS (javascript:, data:, etc.).
 *
 * Uses an ALLOWLIST: only http(s) — the safe schemes for a rendered website
 * link — are permitted. Every other protocol (javascript:, data:, vbscript:,
 * file:, blob:, filesystem:, intent:, chrome:, ftp:, …) collapses to
 * 'about:blank'. Deny-lists are unsafe here because any unlisted scheme would
 * otherwise survive validation.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Trim whitespace and strip control characters BEFORE any protocol check —
  // browsers drop \n/\t/\0 etc. when interpreting href, so an obfuscated
  // `java\nscript:` would otherwise survive validation and run as `javascript:`.
  // Control chars are intentional here; the no-control-regex lint rule does not apply.
  // eslint-disable-next-line no-control-regex
  const trimmedUrl = url.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  if (!trimmedUrl) return '';

  try {
    // If it doesn't have a protocol, add https:// to parse it.
    // An explicit scheme (javascript:, blob:, http://, …) is parsed as-is so
    // its protocol can be checked against the allowlist.
    const hasProtocol = /^[a-zA-Z0-9+.-]+:\/\//.test(trimmedUrl);
    const hasSchemeWithoutSlashes = /^[a-zA-Z0-9+.-]+:/.test(trimmedUrl) && !hasProtocol;
    const hasScheme = hasProtocol || hasSchemeWithoutSlashes;

    const urlToParse = hasScheme ? trimmedUrl : `https://${trimmedUrl}`;
    const parsedUrl = new URL(urlToParse);

    if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
      return 'about:blank';
    }

    // For an explicitly-schemed URL return the parsed (normalized) href; for a
    // bare host return the original input so callers can re-display it verbatim.
    return hasScheme ? parsedUrl.href : trimmedUrl;

  } catch {
    // Malformed string that URL() could not parse. If it carries any explicit
    // scheme we cannot vouch for, deny it; otherwise treat it as a bare host.
    if (/^[a-zA-Z0-9+.-]+:/.test(trimmedUrl)) {
      return 'about:blank';
    }
    return trimmedUrl;
  }
}

/**
 * Normalizes a URL by ensuring it has a protocol.
 */
export function normalizeUrl(url: string | null | undefined): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized || sanitized === 'about:blank') return sanitized;

  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    return `https://${sanitized}`;
  }
  return sanitized;
}
