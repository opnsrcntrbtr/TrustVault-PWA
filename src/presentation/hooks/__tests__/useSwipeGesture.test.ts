/**
 * useSwipeGesture Hook Tests (Phase 4.3 — mobile optimization)
 * Simulates React touch event sequences and verifies swipe direction
 * detection and the minimum-distance threshold.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '@/presentation/hooks/useSwipeGesture';

function touchEvent(clientX: number): React.TouchEvent {
  return {
    targetTouches: [{ clientX }],
  } as unknown as React.TouchEvent;
}

function performSwipe(
  result: { current: ReturnType<typeof useSwipeGesture> },
  startX: number,
  endX: number
): void {
  act(() => {
    result.current.onTouchStart(touchEvent(startX));
  });
  act(() => {
    result.current.onTouchMove(touchEvent(endX));
  });
  act(() => {
    result.current.onTouchEnd();
  });
}

describe('useSwipeGesture', () => {
  it('fires onSwipeLeft for a leftward swipe beyond the threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    performSwipe(result, 300, 100); // moved 200px left

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('fires onSwipeRight for a rightward swipe beyond the threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    performSwipe(result, 100, 300); // moved 200px right

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores movement below the default 50px threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    performSwipe(result, 200, 170); // only 30px left

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('honors a custom minSwipeDistance', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({ onSwipeLeft, minSwipeDistance: 150 })
    );

    performSwipe(result, 300, 200); // 100px left — below custom threshold
    expect(onSwipeLeft).not.toHaveBeenCalled();

    performSwipe(result, 400, 200); // 200px left — above custom threshold
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('does nothing on touchEnd without a preceding touchMove (tap)', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft, onSwipeRight }));

    act(() => {
      result.current.onTouchStart(touchEvent(200));
    });
    act(() => {
      result.current.onTouchEnd();
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('resets touchEnd on a new touchStart so stale moves do not fire', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft }));

    performSwipe(result, 300, 100);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);

    // New touch sequence: start then immediately end (no move)
    act(() => {
      result.current.onTouchStart(touchEvent(300));
    });
    act(() => {
      result.current.onTouchEnd();
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1); // unchanged
  });
});
