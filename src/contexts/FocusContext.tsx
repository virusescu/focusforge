import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory } from '../types';
import { soundEngine, playObjectiveComplete } from '../utils/audio';
import { useTimer } from '../hooks/useTimer';
import { useUser } from './UserContext';
import { useAuth } from './AuthContext';
import {
  getRecentSessions,
  getDailyFocusStats,
  saveFocusSession as dbSaveFocusSession,
  getGlobalStats,
  getObjectives,
  addObjective as dbAddObjective,
  deleteObjective as dbDeleteObjective,
  updateObjective as dbUpdateObjective,
  completeObjective as dbCompleteObjective,
  reorderObjectives as dbReorderObjectives,
  moveObjectiveToOtherList as dbMoveObjectiveToOtherList,
  getCategories,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  updateObjectiveCategory as dbUpdateObjectiveCategory,
  updateObjectiveDetails as dbUpdateObjectiveDetails
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
  categories: ObjectiveCategory[];
  saveSession: (startTime: string, durationSeconds: number, pauseTimes?: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  addObjective: (text: string, categoryId?: number | null, prepend?: boolean) => Promise<void>;
  deleteObjective: (id: number) => Promise<void>;
  updateObjective: (id: number, text: string) => Promise<void>;
  updateObjectiveCategory: (id: number, categoryId: number | null) => Promise<void>;
  updateObjectiveDetails: (id: number, details: string | null) => Promise<void>;
  setActiveObjective: (id: number | null) => void;
  neutralizeObjective: (id: number) => Promise<void>;
  reorderObjectives: (orderedIds: number[]) => Promise<void>;
  moveObjectiveToOtherList: (id: number) => Promise<void>;
  objectiveView: 'mission' | 'backlog';
  switchObjectiveView: (view: 'mission' | 'backlog') => void;
  missionObjectives: StrategicObjective[];
  backlogObjectives: StrategicObjective[];
  addCategory: (label: string, color: string, coinBounty?: number) => Promise<void>;
  updateCategory: (id: number, label: string, color: string, coinBounty?: number) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  loading: boolean;
  timerStatus: 'idle' | 'active' | 'paused';
  // Timer state
  seconds: number;
  minutes: number;
  isActive: boolean;
  pauseSeconds: number;
  pauseLimit: number;
  toggleTimer: () => void;
  resetTimer: () => void;
  formatTime: (totalSeconds: number) => string;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuth();
  const { user } = useUser();
  const { 
    seconds, 
    isActive, 
    minutes, 
    pauseSeconds, 
    pauseLimit, 
    toggleTimer: baseToggle, 
    resetTimer: baseReset, 
    formatTime 
  } = useTimer(import.meta.env.DEV ? (user?.debug_speed || 1) : 1);

  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [globalStats, setGlobalStats] = useState<FocusContextType['globalStats']>(null);
  const [objectivePool, setObjectivePool] = useState<StrategicObjective[]>([]);
  const [categories, setCategories] = useState<ObjectiveCategory[]>([]);
  const [objectiveView, setObjectiveView] = useState<'mission' | 'backlog'>('mission');

  const missionObjectives = useMemo(
    () => objectivePool.filter(o => o.is_mission === 1),
    [objectivePool]
  );
  const backlogObjectives = useMemo(
    () => objectivePool.filter(o => o.is_mission === 0),
    [objectivePool]
  );
  const [activeObjectiveId, setActiveObjectiveId] = useState<number | null>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [completedObjectiveText, setCompletedObjectiveText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'active' | 'paused'>('idle');

  useEffect(() => {
    if (isActive) {
      setTimerStatus('active');
    } else if (seconds > 0) {
      setTimerStatus('paused');
    } else {
      setTimerStatus('idle');
    }
  }, [isActive, seconds]);

  const toggleTimer = useCallback(() => {
    if (isActive) {
      soundEngine.playPause();
    } else {
      soundEngine.playStart();
    }
    baseToggle();
  }, [isActive, baseToggle]);

  const resetTimer = useCallback(() => {
    if (seconds > 0) {
      soundEngine.playReboot();
      baseReset();
    } else {
      soundEngine.playDenied();
    }
  }, [seconds, baseReset]);


  const refreshData = useCallback(async () => {
    if (!authUser) return;
    try {
      const [sessions, stats, globals, objectives, cats] = await Promise.all([
        getRecentSessions(authUser.id, 3),
        getDailyFocusStats(authUser.id, 21),
        getGlobalStats(authUser.id),
        getObjectives(authUser.id),
        getCategories(authUser.id)
      ]);
      setRecentSessions(sessions);
      setDailyStats(stats);
      setGlobalStats(globals);
      setObjectivePool(objectives);
      setCategories(cats);
    } catch (e) {
      console.error("Failed to load focus data", e);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const saveSession = useCallback(async (startTime: string, durationSeconds: number, pauseTimes: string[] = []) => {
    if (durationSeconds < 60 || !authUser) return;
    await dbSaveFocusSession(authUser.id, startTime, durationSeconds, pauseTimes);
    await refreshData();
  }, [authUser, refreshData]);

  const addObjective = useCallback(async (text: string, categoryId?: number | null, prepend: boolean = false) => {
    if (!authUser) return;
    const isMission = objectiveView === 'mission' ? 1 : 0;
    await dbAddObjective(authUser.id, text, categoryId, isMission, prepend);
    await refreshData();
  }, [authUser, objectiveView, refreshData]);

  const deleteObjective = useCallback(async (id: number) => {
    await dbDeleteObjective(id);
    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [activeObjectiveId, refreshData]);

  const updateObjective = useCallback(async (id: number, text: string) => {
    await dbUpdateObjective(id, text);
    await refreshData();
  }, [refreshData]);

  const setActiveObjective = useCallback((id: number | null) => {
    setActiveObjectiveId(id);
  }, []);

  const reorderObjectives = useCallback(async (orderedIds: number[]) => {
    const reorderedSet = new Set(orderedIds);
    setObjectivePool(prev => {
      const map = new Map(prev.map(o => [o.id, o]));
      const unchanged = prev.filter(o => !reorderedSet.has(o.id));
      const reordered = orderedIds.map(id => map.get(id)!).filter(Boolean);
      return [...unchanged, ...reordered];
    });
    await dbReorderObjectives(orderedIds);
  }, []);

  const switchObjectiveView = useCallback((view: 'mission' | 'backlog') => {
    setObjectiveView(view);
  }, []);

  const moveObjectiveToOtherList = useCallback(async (id: number) => {
    const targetIsMission = objectiveView === 'mission' ? 0 : 1;
    await dbMoveObjectiveToOtherList(id, targetIsMission);
    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [objectiveView, activeObjectiveId, refreshData]);

  const updateObjectiveCategory = useCallback(async (id: number, categoryId: number | null) => {
    await dbUpdateObjectiveCategory(id, categoryId);
    await refreshData();
  }, [refreshData]);

  const updateObjectiveDetails = useCallback(async (id: number, details: string | null) => {
    await dbUpdateObjectiveDetails(id, details);
    setObjectivePool(prev => prev.map(o => o.id === id ? { ...o, details } : o));
  }, []);

  const addCategory = useCallback(async (label: string, color: string, coinBounty?: number) => {
    if (!authUser) return;
    await dbAddCategory(authUser.id, label, color, coinBounty);
    await refreshData();
  }, [authUser, refreshData]);

  const updateCategory = useCallback(async (id: number, label: string, color: string, coinBounty?: number) => {
    await dbUpdateCategory(id, label, color, coinBounty);
    await refreshData();
  }, [refreshData]);

  const deleteCategory = useCallback(async (id: number) => {
    await dbDeleteCategory(id);
    await refreshData();
  }, [refreshData]);

  const neutralizeObjective = useCallback(async (id: number) => {
    const obj = objectivePool.find(o => o.id === id);
    setCompletedObjectiveText(obj?.text ?? null);
    playObjectiveComplete();
    setIsGlitching(true);
    setTimeout(() => {
      setIsGlitching(false);
      setCompletedObjectiveText(null);
    }, 2800);

    await dbCompleteObjective(id);

    // Dispatch bounty event for GameContext to handle
    const cat = obj?.category_id ? categories.find(c => c.id === obj.category_id) : null;
    const baseBounty = cat?.coin_bounty ?? 15;
    window.dispatchEvent(new CustomEvent('objective-neutralized', { detail: { baseBounty } }));

    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [activeObjectiveId, objectivePool, categories, refreshData]);

  useEffect(() => {
    const handleTimerSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ durationSeconds: number; startTime: string; pauseTimes?: string[] }>;
      if (customEvent.detail && customEvent.detail.durationSeconds) {
        saveSession(
          customEvent.detail.startTime,
          customEvent.detail.durationSeconds,
          customEvent.detail.pauseTimes || []
        );
      }
      setTimerStatus('idle');
    };

    const handleActive = () => setTimerStatus('active');
    const handlePaused = () => setTimerStatus('paused');
    const handleReset = () => setTimerStatus('idle');

    window.addEventListener('timer-saved', handleTimerSaved);
    window.addEventListener('timer-active', handleActive);
    window.addEventListener('timer-paused', handlePaused);
    window.addEventListener('timer-reset', handleReset);

    return () => {
      window.removeEventListener('timer-saved', handleTimerSaved);
      window.removeEventListener('timer-active', handleActive);
      window.removeEventListener('timer-paused', handlePaused);
      window.removeEventListener('timer-reset', handleReset);
    };
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
      categories,
      saveSession,
      refreshData,
      addObjective,
      deleteObjective,
      updateObjective,
      updateObjectiveCategory,
      updateObjectiveDetails,
      setActiveObjective,
      neutralizeObjective,
      reorderObjectives,
      moveObjectiveToOtherList,
      objectiveView,
      switchObjectiveView,
      missionObjectives,
      backlogObjectives,
      addCategory,
      updateCategory,
      deleteCategory,
      loading,
      timerStatus,
      seconds,
      minutes,
      isActive,
      pauseSeconds,
      pauseLimit,
      toggleTimer,
      resetTimer,
      formatTime
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
