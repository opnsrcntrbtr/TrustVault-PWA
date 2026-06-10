/**
 * Base64 Utility Tests
 * These helpers back WebAuthn credential-ID and crypto blob handling, so
 * both standard and URL-safe alphabets must round-trip exactly.
 */

import { describe, it, expect } from 'vitest';
import {
  decodeBase64ToString,
  decodeBase64ToUint8Array,
  encodeUint8ArrayToBase64,
  encodeUint8ArrayToBase64Url,
} from '@/core/utils/base64';

describe('base64 utilities', () => {
  describe('encodeUint8ArrayToBase64()', () => {
    it('encodes a Uint8Array to standard base64', () => {
      const bytes = new TextEncoder().encode('TrustVault');
      expect(encodeUint8ArrayToBase64(bytes)).toBe(btoa('TrustVault'));
    });

    it('accepts an ArrayBuffer input', () => {
      const bytes = new TextEncoder().encode('buffer-input');
      const buffer = bytes.buffer.slice(0);
      expect(encodeUint8ArrayToBase64(buffer)).toBe(btoa('buffer-input'));
    });

    it('encodes binary (non-ASCII) bytes', () => {
      const bytes = new Uint8Array([0, 255, 128, 7, 63]);
      const decoded = decodeBase64ToUint8Array(encodeUint8ArrayToBase64(bytes));
      expect(Array.from(decoded)).toEqual([0, 255, 128, 7, 63]);
    });
  });

  describe('decodeBase64ToString()', () => {
    it('decodes standard base64', () => {
      expect(decodeBase64ToString(btoa('hello world'))).toBe('hello world');
    });

    it('returns an empty string for empty input', () => {
      expect(decodeBase64ToString('')).toBe('');
    });

    it('tolerates whitespace and newlines inside the input', () => {
      const encoded = btoa('multi-line payload');
      const mangled = `${encoded.slice(0, 4)}\r\n  ${encoded.slice(4)}`;
      expect(decodeBase64ToString(mangled)).toBe('multi-line payload');
    });

    it('decodes URL-safe base64 (- and _ alphabet)', () => {
      // 0xfb 0xff encodes to "+/8=" in standard base64 → "-_8" url-safe
      const bytes = new Uint8Array([0xfb, 0xff]);
      const urlSafe = encodeUint8ArrayToBase64Url(bytes);
      expect(urlSafe).not.toMatch(/[+/=]/);
      expect(Array.from(decodeBase64ToUint8Array(urlSafe))).toEqual([0xfb, 0xff]);
    });

    it('restores missing padding', () => {
      const unpadded = btoa('pad-me').replace(/=+$/g, '');
      expect(decodeBase64ToString(unpadded)).toBe('pad-me');
    });

    it('throws on impossible base64 length (remainder 1)', () => {
      expect(() => decodeBase64ToString('abcde')).toThrow('Invalid base64 string');
    });
  });

  describe('decodeBase64ToUint8Array()', () => {
    it('round-trips arbitrary bytes', () => {
      const bytes = crypto.getRandomValues(new Uint8Array(64));
      const decoded = decodeBase64ToUint8Array(encodeUint8ArrayToBase64(bytes));
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    });

    it('returns an empty array for empty input', () => {
      expect(decodeBase64ToUint8Array('').byteLength).toBe(0);
    });
  });

  describe('encodeUint8ArrayToBase64Url()', () => {
    it('strips padding and uses the URL-safe alphabet', () => {
      // Choose bytes guaranteed to produce '+', '/' and '=' in standard b64
      const bytes = new Uint8Array([0xfb, 0xef, 0xff, 0x01]);
      const standard = encodeUint8ArrayToBase64(bytes);
      const urlSafe = encodeUint8ArrayToBase64Url(bytes);

      expect(standard).toMatch(/[+/]/);
      expect(urlSafe).not.toMatch(/[+/=]/);
      expect(Array.from(decodeBase64ToUint8Array(urlSafe))).toEqual(Array.from(bytes));
    });

    it('round-trips random byte sequences of every padding length', () => {
      for (const length of [1, 2, 3, 4, 31, 32, 33]) {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        const decoded = decodeBase64ToUint8Array(encodeUint8ArrayToBase64Url(bytes));
        expect(Array.from(decoded)).toEqual(Array.from(bytes));
      }
    });
  });
});
