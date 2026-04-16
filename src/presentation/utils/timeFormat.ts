/**
 * Time Formatting Utilities
 * Human-readable relative time formatting using ChronCraft
 */

import {
  createDate,
  now as chronNow,
  format,
  diff,
} from 'chroncraft';

/**
 * Format a date as relative time (e.g., "2 hours ago", "3 days ago")
 * @param date - Date to format
 * @param baseTime - Current time (defaults to Date.now())
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(date: Date | number, baseTime: number = Date.now()): string {
  const targetDate = typeof date === 'number' ? new Date(date) : date;
  const diffMs = baseTime - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${String(diffMinutes)} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${String(diffHours)} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${String(diffDays)} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${String(weeks)} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${String(months)} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${String(years)} year${years === 1 ? '' : 's'} ago`;
}

/**
 * Format a date as a short relative time (e.g., "2h", "3d")
 * @param date - Date to format
 * @param baseTime - Current time (defaults to Date.now())
 * @returns Short relative time string
 */
export function formatShortRelativeTime(date: Date | number, baseTime: number = Date.now()): string {
  const targetDate = typeof date === 'number' ? new Date(date) : date;
  const diffMs = baseTime - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'now';
  if (diffMinutes < 60) return `${String(diffMinutes)}m`;
  if (diffHours < 24) return `${String(diffHours)}h`;
  if (diffDays < 7) return `${String(diffDays)}d`;
  if (diffDays < 30) return `${String(Math.floor(diffDays / 7))}w`;
  if (diffDays < 365) return `${String(Math.floor(diffDays / 30))}mo`;
  return `${String(Math.floor(diffDays / 365))}y`;
}

/**
 * Format a date as an absolute date string using ChronCraft
 * @param date - Date to format
 * @param includeTime - Whether to include time (default: false)
 * @returns Formatted date string (e.g., "Jan 15, 2024" or "Jan 15, 2024 at 3:30 PM")
 */
export function formatAbsoluteDate(date: Date | number, includeTime: boolean = false): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  const chronDate = createDate(dateObj);
  
  if (includeTime) {
    // Use Intl for localized time formatting with AM/PM
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  
  // Use ChronCraft for date-only formatting
  return format(chronDate, 'MMM D, YYYY');
}

/**
 * Format a date as a full date-time string using ChronCraft
 * @param date - Date to format
 * @returns Formatted date-time string (e.g., "January 15, 2024 at 3:30:45 PM")
 */
export function formatFullDateTime(date: Date | number): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  const chronDate = createDate(dateObj);
  
  // Use ChronCraft for the date part, Intl for localized time with AM/PM
  const datePart = format(chronDate, 'MMMM D, YYYY');
  const timePart = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
  
  return `${datePart} at ${timePart}`;
}

/**
 * Get a smart formatted time based on how recent the date is
 * Uses ChronCraft's diff() for precise time calculations
 * - "just now" for < 1 minute
 * - Relative time for < 7 days
 * - Absolute date for >= 7 days
 * @param date - Date to format
 * @returns Smart formatted time string
 */
export function formatSmartTime(date: Date | number): string {
  const targetDate = createDate(typeof date === 'number' ? new Date(date) : date);
  const baseDate = chronNow();
  const secondsAgo = diff(targetDate, baseDate, 'second');

  // Less than 7 days: use relative time
  if (secondsAgo < 7 * 24 * 60 * 60) {
    return formatRelativeTime(date, Date.now());
  }

  // 7 days or more: use absolute date
  return formatAbsoluteDate(date, false);
}

/**
 * Format distance to now
 * Returns human-readable relative time string
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Human-readable distance string
 */
export function formatDistanceToNow(
  date: Date | number | string,
  options: { addSuffix?: boolean; includeSeconds?: boolean } = {}
): string {
  const targetDate = typeof date === 'string' ? new Date(date) : 
                     typeof date === 'number' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - targetDate.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const isFuture = diffMs < 0;

  let result: string;
  if (options.includeSeconds && diffSeconds < 60) {
    result = diffSeconds < 5 ? 'less than 5 seconds' :
             diffSeconds < 10 ? 'less than 10 seconds' :
             diffSeconds < 30 ? 'less than 30 seconds' :
             'less than a minute';
  } else if (diffMinutes < 1) {
    result = 'less than a minute';
  } else if (diffMinutes < 60) {
    result = diffMinutes === 1 ? '1 minute' : `${String(diffMinutes)} minutes`;
  } else if (diffHours < 24) {
    result = diffHours === 1 ? 'about 1 hour' : `about ${String(diffHours)} hours`;
  } else if (diffDays < 30) {
    result = diffDays === 1 ? '1 day' : `${String(diffDays)} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    result = months === 1 ? 'about 1 month' : `about ${String(months)} months`;
  } else {
    const years = Math.floor(diffDays / 365);
    result = years === 1 ? 'about 1 year' : `about ${String(years)} years`;
  }

  if (options.addSuffix) {
    return isFuture ? `in ${result}` : `${result} ago`;
  }
  return result;
}
