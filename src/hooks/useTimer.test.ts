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

  it('includes startTime in timer-saved event', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const startTime = new Date('2024-03-24T10:00:00.000Z');
    vi.setSystemTime(startTime);

    const { result } = renderHook(() => useTimer(1));
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ startTime: '2024-03-24T10:00:00.000Z' })
      })
    );

    window.removeEventListener('timer-saved', listener);
  });

  it('records pause timestamp when timer is paused mid-session', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const { result } = renderHook(() => useTimer(1));

    vi.setSystemTime(new Date('2024-03-24T10:00:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // start
    act(() => { vi.advanceTimersByTime(10000); });

    vi.setSystemTime(new Date('2024-03-24T10:15:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // pause

    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ pauseTimes: ['2024-03-24T10:15:00.000Z'] })
      })
    );

    window.removeEventListener('timer-saved', listener);
  });

  it('records multiple pause timestamps', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const { result } = renderHook(() => useTimer(1));

    vi.setSystemTime(new Date('2024-03-24T10:00:00.000Z'));
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(20000); });

    vi.setSystemTime(new Date('2024-03-24T10:20:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // first pause

    act(() => { result.current.toggleTimer(); }); // resume

    vi.setSystemTime(new Date('2024-03-24T10:40:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // second pause

    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          pauseTimes: ['2024-03-24T10:20:00.000Z', '2024-03-24T10:40:00.000Z'],
        })
      })
    );

    window.removeEventListener('timer-saved', listener);
  });

  it('clears pauseTimes and startTime after reset so next session starts fresh', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const { result } = renderHook(() => useTimer(1));

    vi.setSystemTime(new Date('2024-03-24T10:00:00.000Z'));
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    vi.setSystemTime(new Date('2024-03-24T10:15:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // pause
    act(() => { result.current.resetTimer(); }); // save + reset

    listener.mockClear();

    // Second session — no pauses
    vi.setSystemTime(new Date('2024-03-24T11:00:00.000Z'));
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          startTime: '2024-03-24T11:00:00.000Z',
          pauseTimes: [],
        })
      })
    );

    window.removeEventListener('timer-saved', listener);
  });
});
