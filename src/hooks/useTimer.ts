import { useState, useEffect, useCallback } from 'react';

export const useTimer = (multiplier: number = 1) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + multiplier);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, multiplier]);

  const toggleTimer = useCallback(() => {
    const nextState = !isActive;
    setIsActive(nextState);
    if (nextState) {
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
      window.dispatchEvent(new CustomEvent('timer-paused'));
    }
  }, [isActive]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    window.dispatchEvent(new CustomEvent('timer-reset'));
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    seconds,
    isActive,
    toggleTimer,
    resetTimer,
    formatTime,
    minutes: seconds / 60
  };
};
