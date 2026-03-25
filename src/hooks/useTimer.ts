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

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setPauseSeconds(0);
    if (secondsRef.current > 0) {
      window.dispatchEvent(new CustomEvent('timer-saved', {
        detail: {
          durationSeconds: secondsRef.current,
          startTime: startTimeRef.current ?? new Date().toISOString(),
          pauseTimes: [...pauseTimesRef.current],
        },
      }));
    }
    setSeconds(0);
    startTimeRef.current = null;
    pauseTimesRef.current = [];
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
      }
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
      // Pausing — record wall-clock time of this pause
      pauseTimesRef.current = [...pauseTimesRef.current, new Date().toISOString()];
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
