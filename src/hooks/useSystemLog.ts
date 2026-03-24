import { useState, useEffect, useCallback } from 'react';
import { LOG_MESSAGES } from '../logData';
import type { LogEntry, LogCategory } from '../types';

export const useSystemLog = (maxLogs: number = 100) => {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', time: new Date().toLocaleTimeString([], { hour12: false }), msg: 'SYSTEM_READY', type: 'info' }
  ]);
  const [isActive, setIsActive] = useState(false);

  const addLog = useCallback((category: LogCategory, type: string = 'info') => {
    const pool = LOG_MESSAGES[category];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 11),
      time: new Date().toLocaleTimeString([], { hour12: false }),
      msg,
      type
    };
    setLogs(prev => [...prev, newLog].slice(-maxLogs));
  }, [maxLogs]);

  useEffect(() => {
    const onStart = () => {
      setIsActive(true);
      addLog('START', 'success');
    };
    const onPause = () => {
      setIsActive(false);
      addLog('HALT', 'warning');
    };
    const onReset = () => {
      setIsActive(false);
      addLog('REBOOT', 'info');
    };

    window.addEventListener('timer-active', onStart);
    window.addEventListener('timer-paused', onPause);
    window.addEventListener('timer-reset', onReset);
    return () => {
      window.removeEventListener('timer-active', onStart);
      window.removeEventListener('timer-paused', onPause);
      window.removeEventListener('timer-reset', onReset);
    };
  }, [addLog]);

  useEffect(() => {
    let timeout: number;
    const tick = () => {
      if (isActive) {
        addLog('IDLE', 'info');
      }
      const delay = Math.random() * 400; // 0-0.4s
      timeout = setTimeout(tick, delay) as unknown as number;
    };
    timeout = setTimeout(tick, 400) as unknown as number;
    return () => clearTimeout(timeout);
  }, [isActive, addLog]);

  return { logs, addLog };
};
