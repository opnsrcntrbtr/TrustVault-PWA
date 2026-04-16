/*
 * Base64 utility helpers that handle both standard and URL-safe encodings.
 */

function normalizeBase64(input: string): string {
  const sanitized = input.replace(/[\r\n\s]/g, '');
  const replaced = sanitized.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = replaced.length % 4;

  if (remainder === 0) {
    return replaced;
  }

  if (remainder === 1) {
    throw new Error('Invalid base64 string');
  }

  return replaced + '='.repeat(4 - remainder);
}

export function decodeBase64ToString(input: string): string {
  if (!input) {
    return '';
  }

  const normalized = normalizeBase64(input);
  return atob(normalized);
}

export function decodeBase64ToUint8Array(input: string): Uint8Array {
  const binary = decodeBase64ToString(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function encodeUint8ArrayToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.byteLength; i++) {
    binary += String.fromCharCode(view[i] as number);
  }
  return btoa(binary);
}

export function encodeUint8ArrayToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  return encodeUint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
