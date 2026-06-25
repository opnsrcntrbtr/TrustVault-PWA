/**
 * Performance Utility Tests
 * Covers render-time warning thresholds, debounce/throttle collapsing
 * behavior, and the small environment-detection helpers.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  measureRender,
  debounce,
  throttle,
  isStandalone,
  prefersReducedMotion,
  getConnectionSpeed,
} from '@/presentation/utils/performance';

describe('performance utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('measureRender()', () => {
    it('warns when render time exceeds one frame (16ms)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const slowStart = performance.now() - 20;

      measureRender('SlowComponent', slowStart);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SlowComponent'));
    });

    it('does not warn when render time is within one frame', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      measureRender('FastComponent', performance.now());

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('debounce()', () => {
    it('does not call the wrapped function before the wait elapses', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('a');

      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(199);
      expect(fn).not.toHaveBeenCalled();
    });

    it('calls the wrapped function exactly once after rapid repeated calls', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('a');
      debounced('b');
      debounced('c');
      vi.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('calls the wrapped function with the most recent arguments', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 200);

      debounced('first');
      debounced('last');
      vi.advanceTimersByTime(200);

      expect(fn).toHaveBeenCalledWith('last');
    });
  });

  describe('throttle()', () => {
    it('calls the wrapped function immediately on the first invocation', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 200);

      throttled('a');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('ignores calls made within the throttle window', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 200);

      throttled('a');
      throttled('b');
      throttled('c');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('allows another call once the throttle window has elapsed', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 200);

      throttled('a');
      vi.advanceTimersByTime(200);
      throttled('b');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('isStandalone()', () => {
    it('returns true when display-mode: standalone matches', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);

      expect(isStandalone()).toBe(true);
    });

    it('returns false when neither standalone signal is present', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

      expect(isStandalone()).toBe(false);
    });
  });

  describe('prefersReducedMotion()', () => {
    it('reflects the prefers-reduced-motion media query result', () => {
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
      } as MediaQueryList);

      expect(prefersReducedMotion()).toBe(true);
      expect(matchMediaSpy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });
  });

  describe('getConnectionSpeed()', () => {
    it('returns "unknown" when the Network Information API is unavailable', () => {
      vi.stubGlobal('navigator', {});

      expect(getConnectionSpeed()).toBe('unknown');
    });
  });
});
