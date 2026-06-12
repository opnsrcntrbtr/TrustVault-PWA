/**
 * Sanitizes a URL to prevent javascript: and data: protocol XSS attacks.
 * If the URL is invalid or uses a dangerous protocol, returns a safe fallback or empty string.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Trim whitespace
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return '';

  try {
    // If it doesn't have a protocol, add https:// to parse it
    // But if it's explicitly javascript: or data:, URL parsing will catch it
    const hasProtocol = /^[a-zA-Z0-9+.-]+:\/\//.test(trimmedUrl);
    const hasSchemaWithoutSlashes = /^[a-zA-Z0-9+.-]+:/.test(trimmedUrl) && !hasProtocol;

    // If it has a schema like javascript: without //
    if (hasSchemaWithoutSlashes) {
      const parsed = new URL(trimmedUrl);
      if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(parsed.protocol)) {
        return 'about:blank';
      }
      return trimmedUrl;
    }

    const urlToParse = hasProtocol ? trimmedUrl : `https://${trimmedUrl}`;
    const parsedUrl = new URL(urlToParse);

    if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(parsedUrl.protocol)) {
      return 'about:blank';
    }

    // Return original if no protocol was added, otherwise return parsed href
    return hasProtocol ? parsedUrl.href : trimmedUrl;

  } catch {
    // If URL parsing fails, it's likely a malformed string
    // Let's do a fallback string check just in case
    const lowerUrl = trimmedUrl.toLowerCase();
    if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:') || lowerUrl.startsWith('file:')) {
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
