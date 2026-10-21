import { useEffect, useState } from 'react';

// The current time, refreshed every `intervalMs`, so deadline colors change while the app stays open
export function useNow(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
