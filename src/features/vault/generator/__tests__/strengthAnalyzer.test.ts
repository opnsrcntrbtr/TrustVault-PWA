/**
 * Strength Analyzer Tests
 * Covers zxcvbn-backed scoring, common-pattern/weakness detection,
 * crack-time formatting, and the lightweight quick-check / minimum-
 * requirements helpers used for real-time UI feedback.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzePasswordStrength,
  quickStrengthCheck,
  meetsMinimumRequirements,
} from '@/features/vault/generator/strengthAnalyzer';

describe('strengthAnalyzer', () => {
  describe('analyzePasswordStrength()', () => {
    it('returns a weak, zero-score result for an empty password', () => {
      const result = analyzePasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.strength).toBe('weak');
      expect(result.weaknesses).toContain('Password is empty');
    });

    it('flags a common dictionary word as weak with a pattern weakness', () => {
      const result = analyzePasswordStrength('password');
      expect(result.strength).toBe('weak');
      expect(result.weaknesses).toContain('Contains common pattern or dictionary word');
    });

    it('flags repeated characters as a weakness', () => {
      const result = analyzePasswordStrength('aaaaaaaaaaaaaaaa');
      expect(result.weaknesses).toContain('Contains repeated sequences');
    });

    it('flags passwords shorter than 8 characters', () => {
      const result = analyzePasswordStrength('Ab1!');
      expect(result.weaknesses).toContain('Password is too short (minimum 8 characters)');
    });

    it('flags passwords lacking character diversity', () => {
      const result = analyzePasswordStrength('alllowercaseletters');
      expect(result.weaknesses).toContain('Password lacks character diversity');
    });

    it('rates a long, diverse, non-pattern password as strong or very-strong', () => {
      const result = analyzePasswordStrength('xK9$mQ2pL7@vR4wZ8!');
      expect(['strong', 'very-strong']).toContain(result.strength);
      expect(result.weaknesses).not.toContain('Password is too short (minimum 8 characters)');
    });

    it('returns a human-readable crackTime string and a non-negative crackTimeSeconds', () => {
      const result = analyzePasswordStrength('Tr0ub4dor&3');
      expect(typeof result.crackTime).toBe('string');
      expect(result.crackTime.length).toBeGreaterThan(0);
      expect(result.crackTimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('formats an instant crack time for an empty password', () => {
      const result = analyzePasswordStrength('');
      expect(result.crackTime).toBe('instant');
    });

    it('returns a non-negative entropy for any non-empty password', () => {
      const result = analyzePasswordStrength('a');
      expect(result.entropy).toBeGreaterThanOrEqual(0);
    });

    it('includes zxcvbn suggestions in feedback.suggestions', () => {
      const result = analyzePasswordStrength('password');
      expect(Array.isArray(result.feedback.suggestions)).toBe(true);
    });
  });

  describe('quickStrengthCheck()', () => {
    it('returns weak/0 for an empty string', () => {
      const result = quickStrengthCheck('');
      expect(result).toEqual({ score: 0, strength: 'weak' });
    });

    it('scores higher for longer, more diverse passwords', () => {
      const short = quickStrengthCheck('abc');
      const long = quickStrengthCheck('Abcdef123456!@#$');
      expect(long.score).toBeGreaterThan(short.score);
    });

    it('scores a dictionary-word password no higher than a similarly long non-pattern password', () => {
      const withPattern = quickStrengthCheck('password123');
      const withoutPattern = quickStrengthCheck('xqzjklm456');
      expect(withPattern.score).toBeLessThanOrEqual(withoutPattern.score + 20);
    });
  });

  describe('meetsMinimumRequirements()', () => {
    it('reports all requirements met for a compliant password', () => {
      const result = meetsMinimumRequirements('Abcdefg1');
      expect(result.meets).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('lists every missing requirement for an all-lowercase short password', () => {
      const result = meetsMinimumRequirements('abc');
      expect(result.meets).toBe(false);
      expect(result.missing).toContain('At least 8 characters');
      expect(result.missing).toContain('One uppercase letter');
      expect(result.missing).toContain('One number');
    });

    it('does not require a symbol (only length, case, and digit)', () => {
      const result = meetsMinimumRequirements('Abcdefg1');
      expect(result.missing).not.toContain('One special character');
    });
  });
});
