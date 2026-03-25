import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { FocusSession, DailyStat, StrategicObjective } from '../types';
import { soundEngine, playObjectiveComplete } from '../utils/audio';
import {
  getRecentSessions,
  getDailyFocusStats,
  saveFocusSession as dbSaveFocusSession,
  getGlobalStats,
  getObjectives,
  addObjective as dbAddObjective,
  deleteObjective as dbDeleteObjective,
  reorderObjectives as dbReorderObjectives
} from '../db';

interface FocusContextType {
  recentSessions: FocusSession[];
  dailyStats: DailyStat[];
  globalStats: {
    allTimeTotal: number;
    allTimePeak: number;
    weekTotal: number;
    monthTotal: number;
  } | null;
  objectivePool: StrategicObjective[];
  activeObjectiveId: number | null;
  isGlitching: boolean;
  completedObjectiveText: string | null;
  saveSession: (durationSeconds: number) => Promise<void>;
  refreshData: () => Promise<void>;
  addObjective: (text: string) => Promise<void>;
  deleteObjective: (id: number) => Promise<void>;
  setActiveObjective: (id: number | null) => void;
  neutralizeObjective: (id: number) => Promise<void>;
  reorderObjectives: (orderedIds: number[]) => Promise<void>;
  loading: boolean;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [globalStats, setGlobalStats] = useState<FocusContextType['globalStats']>(null);
  const [objectivePool, setObjectivePool] = useState<StrategicObjective[]>([]);
  const [activeObjectiveId, setActiveObjectiveId] = useState<number | null>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [completedObjectiveText, setCompletedObjectiveText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [sessions, stats, globals, objectives] = await Promise.all([
        getRecentSessions(3),
        getDailyFocusStats(21),
        getGlobalStats(),
        getObjectives()
      ]);
      setRecentSessions(sessions);
      setDailyStats(stats);
      setGlobalStats(globals);
      setObjectivePool(objectives);
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

  const addObjective = useCallback(async (text: string) => {
    await dbAddObjective(text);
    await refreshData();
  }, [refreshData]);

  const deleteObjective = useCallback(async (id: number) => {
    await dbDeleteObjective(id);
    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [activeObjectiveId, refreshData]);

  const setActiveObjective = useCallback((id: number | null) => {
    setActiveObjectiveId(id);
  }, []);

  const reorderObjectives = useCallback(async (orderedIds: number[]) => {
    setObjectivePool(prev => {
      const map = new Map(prev.map(o => [o.id, o]));
      return orderedIds.map(id => map.get(id)!).filter(Boolean);
    });
    await dbReorderObjectives(orderedIds);
  }, []);

  const neutralizeObjective = useCallback(async (id: number) => {
    const obj = objectivePool.find(o => o.id === id);
    setCompletedObjectiveText(obj?.text ?? null);
    playObjectiveComplete();
    setIsGlitching(true);
    setTimeout(() => {
      setIsGlitching(false);
      setCompletedObjectiveText(null);
    }, 2800);

    await dbDeleteObjective(id);
    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [activeObjectiveId, refreshData]);

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
    <FocusContext.Provider value={{ 
      recentSessions, 
      dailyStats, 
      globalStats, 
      objectivePool,
      activeObjectiveId,
      isGlitching,
      completedObjectiveText,
      saveSession, 
      refreshData, 
      addObjective,
      deleteObjective,
      setActiveObjective,
      neutralizeObjective,
      reorderObjectives,
      loading
    }}>
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
