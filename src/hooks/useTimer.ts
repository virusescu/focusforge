import { useState, useEffect, useCallback, useRef } from 'react';
import { soundEngine } from '../utils/audio';

const PAUSE_LIMIT = 60; // seconds

export const useTimer = (multiplier: number = 1) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);

  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;

  const startTimeRef = useRef<string | null>(null);
  const pauseTimesRef = useRef<string[]>([]);
  const lastPauseRef = useRef<string | null>(null);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setPauseSeconds(0);
    if (secondsRef.current > 0) {
      window.dispatchEvent(new CustomEvent('timer-saved', {
        detail: {
          durationSeconds: secondsRef.current,
          startTime: startTimeRef.current ?? new Date().toISOString(),
          pauseTimes: lastPauseRef.current
            ? [...pauseTimesRef.current, lastPauseRef.current]
            : [...pauseTimesRef.current],
        },
      }));
    }
    setSeconds(0);
    startTimeRef.current = null;
    pauseTimesRef.current = [];
    lastPauseRef.current = null;
    window.dispatchEvent(new CustomEvent('timer-reset'));
  }, []);

  // Focus tick
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + multiplier);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, multiplier]);

  // Pause countdown — only runs when paused mid-session
  useEffect(() => {
    if (isActive || seconds === 0) {
      setPauseSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setPauseSeconds((prev) => {
        const next = prev + multiplier;
        if (next >= PAUSE_LIMIT) {
          clearInterval(interval);
          soundEngine.playReboot();
          window.dispatchEvent(new CustomEvent('timer-reset'));
          resetTimer();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, seconds, resetTimer]);

  const toggleTimer = useCallback(() => {
    const nextState = !isActive;
    setIsActive(nextState);
    if (nextState) {
      // Starting or resuming — record start time on first activation only
      if (!startTimeRef.current) {
        startTimeRef.current = new Date().toISOString();
      } else if (lastPauseRef.current) {
        // Resuming after a pause — the pause counts as an interrupt
        pauseTimesRef.current = [...pauseTimesRef.current, lastPauseRef.current];
      }
      lastPauseRef.current = null;
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
      // Pausing — record the pause but don't count it yet (only if followed by resume)
      lastPauseRef.current = new Date().toISOString();
      window.dispatchEvent(new CustomEvent('timer-paused'));
    }
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    seconds,
    isActive,
    pauseSeconds,
    pauseLimit: PAUSE_LIMIT,
    toggleTimer,
    resetTimer,
    formatTime,
    minutes: seconds / 60,
  };
};
