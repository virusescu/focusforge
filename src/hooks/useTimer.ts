import { useState, useEffect, useCallback, useRef } from 'react';
import { soundEngine } from '../utils/audio';

const PAUSE_LIMIT = 60; // seconds

export const useTimer = (multiplier: number = 1) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);

  // Keep a ref to the latest seconds so resetTimer can read it without stale closure
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setPauseSeconds(0);
    if (secondsRef.current > 0) {
      window.dispatchEvent(new CustomEvent('timer-saved', { detail: { durationSeconds: secondsRef.current } }));
    }
    setSeconds(0);
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
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
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
