import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatAbsoluteDate,
  formatDistanceToNow,
  formatFullDateTime,
  formatRelativeTime,
  formatShortRelativeTime,
  formatSmartTime,
} from '../timeFormat';

describe('timeFormat utilities', () => {
  const baseTime = new Date(2026, 0, 15, 12, 0, 0).getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats relative time across major boundaries', () => {
    expect(formatRelativeTime(baseTime - 30 * 1000, baseTime)).toBe('just now');
    expect(formatRelativeTime(baseTime - 60 * 1000, baseTime)).toBe('1 minute ago');
    expect(formatRelativeTime(baseTime - 2 * 60 * 60 * 1000, baseTime)).toBe('2 hours ago');
    expect(formatRelativeTime(baseTime - 3 * 24 * 60 * 60 * 1000, baseTime)).toBe('3 days ago');
    expect(formatRelativeTime(baseTime - 14 * 24 * 60 * 60 * 1000, baseTime)).toBe('2 weeks ago');
    expect(formatRelativeTime(baseTime - 90 * 24 * 60 * 60 * 1000, baseTime)).toBe('3 months ago');
    expect(formatRelativeTime(baseTime - 370 * 24 * 60 * 60 * 1000, baseTime)).toBe('1 year ago');
  });

  it('formats short relative time variants', () => {
    expect(formatShortRelativeTime(baseTime - 30 * 1000, baseTime)).toBe('now');
    expect(formatShortRelativeTime(baseTime - 4 * 60 * 1000, baseTime)).toBe('4m');
    expect(formatShortRelativeTime(baseTime - 5 * 60 * 60 * 1000, baseTime)).toBe('5h');
    expect(formatShortRelativeTime(baseTime - 6 * 24 * 60 * 60 * 1000, baseTime)).toBe('6d');
    expect(formatShortRelativeTime(baseTime - 21 * 24 * 60 * 60 * 1000, baseTime)).toBe('3w');
    expect(formatShortRelativeTime(baseTime - 180 * 24 * 60 * 60 * 1000, baseTime)).toBe('6mo');
    expect(formatShortRelativeTime(baseTime - 800 * 24 * 60 * 60 * 1000, baseTime)).toBe('2y');
  });

  it('formats absolute dates with and without time', () => {
    const date = new Date(2026, 0, 15, 12, 34, 56);

    expect(formatAbsoluteDate(date)).toBe('Jan 15, 2026');

    const withTime = formatAbsoluteDate(date, true);
    expect(withTime).toContain('2026');
    expect(withTime).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats full date time with descriptive separator', () => {
    const formatted = formatFullDateTime(new Date(2026, 1, 1, 8, 9, 10));

    expect(formatted).toContain('2026');
    expect(formatted).toContain(' at ');
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('uses relative format for recent timestamps in smart mode', () => {
    const recent = baseTime - 2 * 60 * 60 * 1000;
    expect(formatSmartTime(recent)).toBe('2 hours ago');
  });

  it('uses absolute date format for timestamps older than 7 days in smart mode', () => {
    const old = baseTime - 10 * 24 * 60 * 60 * 1000;
    expect(formatSmartTime(old)).toBe('Jan 5, 2026');
  });

  it('formats distance to now with seconds and suffix options', () => {
    expect(formatDistanceToNow(baseTime - 3 * 1000, { includeSeconds: true })).toBe('less than 5 seconds');
    expect(formatDistanceToNow(baseTime - 90 * 1000)).toBe('1 minute');
    expect(formatDistanceToNow(baseTime - 2 * 60 * 60 * 1000, { addSuffix: true })).toBe('about 2 hours ago');
    expect(formatDistanceToNow(baseTime + 2 * 60 * 1000, { addSuffix: true })).toBe('in 2 minutes');
  });

  it('accepts string date input for distance formatting', () => {
    // No 'Z': parsed in the local frame to match baseTime (also local), so the
    // gap is exactly 24h regardless of the test runner's timezone.
    const value = formatDistanceToNow('2026-01-14T12:00:00');
    expect(value).toBe('1 day');
  });
});
