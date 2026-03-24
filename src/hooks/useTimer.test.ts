import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from './useTimer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with 0 seconds and inactive', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('should toggle timer state', () => {
    const { result } = renderHook(() => useTimer());
    act(() => {
      result.current.toggleTimer();
    });
    expect(result.current.isActive).toBe(true);
    act(() => {
      result.current.toggleTimer();
    });
    expect(result.current.isActive).toBe(false);
  });

  it('should increment seconds when active', () => {
    const { result } = renderHook(() => useTimer(1));
    act(() => {
      result.current.toggleTimer();
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.seconds).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.seconds).toBe(3);
  });

  it('should use multiplier for incrementing', () => {
    const { result } = renderHook(() => useTimer(10));
    act(() => {
      result.current.toggleTimer();
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.seconds).toBe(10);
  });

  it('should reset timer', () => {
    const { result } = renderHook(() => useTimer());
    act(() => {
      result.current.toggleTimer();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(5);

    act(() => {
      result.current.resetTimer();
    });
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('should format time correctly', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.formatTime(0)).toBe('00:00');
    expect(result.current.formatTime(65)).toBe('01:05');
    expect(result.current.formatTime(3600)).toBe('60:00');
  });
});
