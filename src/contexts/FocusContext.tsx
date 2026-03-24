import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { FocusSession, DailyStat } from '../types';
import { getRecentSessions, getDailyFocusStats, saveFocusSession as dbSaveFocusSession, getGlobalStats } from '../db';

interface FocusContextType {
  recentSessions: FocusSession[];
  dailyStats: DailyStat[];
  globalStats: {
    allTimeTotal: number;
    allTimePeak: number;
    weekTotal: number;
    monthTotal: number;
  } | null;
  saveSession: (durationSeconds: number) => Promise<void>;
  refreshData: () => Promise<void>;
  loading: boolean;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [globalStats, setGlobalStats] = useState<FocusContextType['globalStats']>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [sessions, stats, globals] = await Promise.all([
        getRecentSessions(3),
        getDailyFocusStats(21),
        getGlobalStats()
      ]);
      setRecentSessions(sessions);
      setDailyStats(stats);
      setGlobalStats(globals);
    } catch (e) {
      console.error("Failed to load focus data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const saveSession = useCallback(async (durationSeconds: number) => {
    if (durationSeconds < 60) return; // Don't save sessions under 1 minute

    const startTime = new Date().toISOString();
    await dbSaveFocusSession(startTime, durationSeconds);
    await refreshData();
  }, [refreshData]);

  useEffect(() => {
    const handleTimerSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ durationSeconds: number }>;
      if (customEvent.detail && customEvent.detail.durationSeconds) {
        saveSession(customEvent.detail.durationSeconds);
      }
    };

    window.addEventListener('timer-saved', handleTimerSaved);
    return () => window.removeEventListener('timer-saved', handleTimerSaved);
  }, [saveSession]);

  return (
    <FocusContext.Provider value={{ recentSessions, dailyStats, globalStats, saveSession, refreshData, loading }}>
      {children}
    </FocusContext.Provider>
  );
};

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (context === undefined) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
};
