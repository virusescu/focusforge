import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSystemLog } from './useSystemLog';

describe('useSystemLog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with a SYSTEM_READY log', () => {
    const { result } = renderHook(() => useSystemLog());
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].msg).toBe('SYSTEM_READY');
  });

  it('should add a log manually', () => {
    const { result } = renderHook(() => useSystemLog());
    act(() => {
      result.current.addLog('START', 'success');
    });
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[1].type).toBe('success');
  });

  it('should listen to timer-active event', () => {
    const { result } = renderHook(() => useSystemLog());
    act(() => {
      window.dispatchEvent(new CustomEvent('timer-active'));
    });
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[1].type).toBe('success');
  });

  it('should generate IDLE logs when active', () => {
    const { result } = renderHook(() => useSystemLog());
    act(() => {
      window.dispatchEvent(new CustomEvent('timer-active'));
    });
    expect(result.current.logs).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // It should have at least one IDLE log (delay is 0-400ms)
    expect(result.current.logs.length).toBeGreaterThan(2);
    expect(result.current.logs.some(l => l.type === 'info')).toBe(true);
  });

  it('should respect maxLogs limit', () => {
    const maxLogs = 5;
    const { result } = renderHook(() => useSystemLog(maxLogs));
    
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addLog('IDLE');
      }
    });

    expect(result.current.logs).toHaveLength(maxLogs);
  });
});
