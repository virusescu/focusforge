import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory, Bucket, BucketGeometry } from '../types';
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
  duplicateObjective as dbDuplicateObjective,
  reorderCategories as dbReorderCategories,
  deleteObjective as dbDeleteObjective,
  updateObjective as dbUpdateObjective,
  completeObjective as dbCompleteObjective,
  reorderObjectives as dbReorderObjectives,
  setObjectiveMission as dbSetObjectiveMission,
  getCategories,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  updateObjectiveCategory as dbUpdateObjectiveCategory,
  updateObjectiveDetails as dbUpdateObjectiveDetails,
  updateObjectiveInteractionTime as dbUpdateObjectiveInteractionTime,
  getBuckets,
  addBucket as dbAddBucket,
  updateBucket as dbUpdateBucket,
  updateBucketGeometry as dbUpdateBucketGeometry,
  bringBucketToFront as dbBringBucketToFront,
  deleteBucket as dbDeleteBucket,
  moveObjectiveToBucket as dbMoveObjectiveToBucket,
  reorderBucketObjectives as dbReorderBucketObjectives
} from '../db';

export interface AddObjectiveOptions {
  bucketId?: number | null; // default: Unsorted (resolved by db)
  inMission?: boolean;      // default: true
}

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
  viewedObjectiveId: number | null;
  isGlitching: boolean;
  completedObjectiveText: string | null;
  categories: ObjectiveCategory[];
  saveSession: (startTime: string, durationSeconds: number, pauseTimes?: string[]) => Promise<void>;
  refreshData: () => Promise<void>;
  addObjective: (text: string, categoryId?: number | null, prepend?: boolean, options?: AddObjectiveOptions) => Promise<void>;
  deleteObjective: (id: number) => Promise<void>;
  duplicateObjective: (id: number) => Promise<void>;
  updateObjective: (id: number, text: string) => Promise<void>;
  updateObjectiveCategory: (id: number, categoryId: number | null) => Promise<void>;
  updateObjectiveDetails: (id: number, details: string | null) => Promise<void>;
  setActiveObjective: (id: number | null) => void;
  setViewedObjective: (id: number | null) => void;
  neutralizeObjective: (id: number) => Promise<void>;
  reorderObjectives: (orderedIds: number[]) => Promise<void>;
  missionObjectives: StrategicObjective[];
  buckets: Bucket[];
  objectivesByBucket: Map<number, StrategicObjective[]>; // key bucket id; sorted by bucket_sort_order, then id
  setObjectiveMission: (id: number, inMission: boolean) => Promise<void>;
  moveObjectiveToBucket: (id: number, bucketId: number) => Promise<void>;
  reorderBucketObjectives: (bucketId: number, orderedIds: number[]) => Promise<void>;
  addBucket: (name: string, color: string, geometry: BucketGeometry) => Promise<void>;
  updateBucket: (id: number, name: string, color: string) => Promise<void>;
  updateBucketGeometry: (id: number, geometry: BucketGeometry) => Promise<void>;
  bringBucketToFront: (id: number) => Promise<void>;
  deleteBucket: (id: number) => Promise<void>;
  addCategory: (label: string, color: string, coinBounty?: number) => Promise<void>;
  updateCategory: (id: number, label: string, color: string, coinBounty?: number) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  reorderCategories: (orderedIds: number[]) => Promise<void>;
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
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  const missionObjectives = useMemo(
    () => objectivePool.filter(o => o.is_mission === 1),
    [objectivePool]
  );
  const objectivesByBucket = useMemo(() => {
    const map = new Map<number, StrategicObjective[]>();
    for (const b of buckets) {
      if (b.kind !== 'mission') map.set(b.id, []);
    }
    const unsortedId = buckets.find(b => b.kind === 'unsorted')?.id;
    for (const o of objectivePool) {
      const key = o.bucket_id ?? unsortedId;
      if (key === undefined) continue;
      const list = map.get(key);
      if (list) list.push(o);
      else map.set(key, [o]);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        ((a.bucket_sort_order ?? Infinity) - (b.bucket_sort_order ?? Infinity)) || (a.id - b.id)
      );
    }
    return map;
  }, [objectivePool, buckets]);
  const [activeObjectiveId, setActiveObjectiveId] = useState<number | null>(null);
  const [viewedObjectiveId, setViewedObjectiveId] = useState<number | null>(null);
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
      // Buckets first: getBuckets creates the system buckets and backfills objectives.bucket_id
      const bkts = await getBuckets(authUser.id);
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
      setBuckets(bkts);
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

  const addObjective = useCallback(async (text: string, categoryId?: number | null, prepend: boolean = false, options: AddObjectiveOptions = {}) => {
    if (!authUser) return;
    const isMission = options.inMission === false ? 0 : 1;
    await dbAddObjective(authUser.id, text, categoryId, isMission, prepend, options.bucketId ?? null);
    await refreshData();
  }, [authUser, refreshData]);

  const duplicateObjective = useCallback(async (id: number) => {
    await dbDuplicateObjective(id);
    await refreshData();
  }, [refreshData]);

  const deleteObjective = useCallback(async (id: number) => {
    await dbDeleteObjective(id);
    if (activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }
    await refreshData();
  }, [activeObjectiveId, refreshData]);

  const updateObjective = useCallback(async (id: number, text: string) => {
    // Optimistic
    setObjectivePool(prev => prev.map(o => o.id === id ? { ...o, text, last_interacted_at: new Date().toISOString() } : o));
    
    try {
      await dbUpdateObjective(id, text);
      await dbUpdateObjectiveInteractionTime(id);
    } catch (e) {
      console.error('Update failed', e);
      await refreshData(); // Revert on actual error
    }
  }, [refreshData]);

  const setActiveObjective = useCallback((id: number | null) => {
    setActiveObjectiveId(id);
    if (id !== null) {
      setViewedObjectiveId(id);
      setObjectivePool(prev => prev.map(o =>
        o.id === id ? { ...o, last_interacted_at: new Date().toISOString() } : o
      ));
      dbUpdateObjectiveInteractionTime(id);
    }
  }, []);

  const setViewedObjective = useCallback((id: number | null) => {
    setViewedObjectiveId(id);
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

  const setObjectiveMission = useCallback(async (id: number, inMission: boolean) => {
    // 1. Instantly update local state. The objective keeps its bucket; like the DB, it goes
    //    to the end of its new list (sort_order = max + 1), so move it to the end of the pool too.
    setObjectivePool(prev => {
      const target = prev.find(o => o.id === id);
      if (!target) return prev;
      const isMission = inMission ? 1 : 0;
      const rest = prev.filter(o => o.id !== id);
      const maxOrder = rest
        .filter(o => o.is_mission === isMission)
        .reduce((max, o) => Math.max(max, o.sort_order ?? -1), -1);
      return [...rest, { ...target, is_mission: isMission, sort_order: maxOrder + 1, last_interacted_at: new Date().toISOString() }];
    });

    if (!inMission && activeObjectiveId === id) {
      setActiveObjectiveId(null);
    }

    // 2. Sync DB in background WITHOUT refreshData (to avoid stale read race)
    try {
      await dbSetObjectiveMission(id, inMission ? 1 : 0);
      await dbUpdateObjectiveInteractionTime(id);
    } catch (error) {
      console.error('[FocusContext] DB sync failed, reverting UI:', error);
      await refreshData();
    }
  }, [activeObjectiveId, refreshData]);

  const moveObjectiveToBucket = useCallback(async (id: number, bucketId: number) => {
    // Optimistic: append to the end of the target bucket
    setObjectivePool(prev => {
      const maxOrder = prev
        .filter(o => o.id !== id && o.bucket_id === bucketId)
        .reduce((max, o) => Math.max(max, o.bucket_sort_order ?? -1), -1);
      return prev.map(o => o.id === id ? { ...o, bucket_id: bucketId, bucket_sort_order: maxOrder + 1 } : o);
    });

    try {
      await dbMoveObjectiveToBucket(id, bucketId);
    } catch (error) {
      console.error('[FocusContext] Bucket move failed, reverting UI:', error);
      await refreshData();
    }
  }, [refreshData]);

  // bucketId is unused by the DB (objective ids are unique); it keeps call sites explicit
  const reorderBucketObjectives = useCallback(async (_bucketId: number, orderedIds: number[]) => {
    const orderById = new Map(orderedIds.map((id, index) => [id, index]));
    setObjectivePool(prev => prev.map(o => {
      const order = orderById.get(o.id);
      return order === undefined ? o : { ...o, bucket_sort_order: order };
    }));

    try {
      await dbReorderBucketObjectives(orderedIds);
    } catch (error) {
      console.error('[FocusContext] Bucket reorder failed, reverting UI:', error);
      await refreshData();
    }
  }, [refreshData]);

  const addBucket = useCallback(async (name: string, color: string, geometry: BucketGeometry) => {
    if (!authUser) return;
    await dbAddBucket(authUser.id, name, color, geometry);
    await refreshData();
  }, [authUser, refreshData]);

  const updateBucket = useCallback(async (id: number, name: string, color: string) => {
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, name, color } : b));
    try {
      await dbUpdateBucket(id, name, color);
    } catch (error) {
      console.error('[FocusContext] Bucket update failed, reverting UI:', error);
      await refreshData();
    }
  }, [refreshData]);

  const updateBucketGeometry = useCallback(async (id: number, geometry: BucketGeometry) => {
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, ...geometry } : b));
    try {
      await dbUpdateBucketGeometry(id, geometry);
    } catch (error) {
      console.error('[FocusContext] Bucket geometry update failed, reverting UI:', error);
      await refreshData();
    }
  }, [refreshData]);

  const bringBucketToFront = useCallback(async (id: number) => {
    const others = buckets.filter(b => b.id !== id);
    const target = buckets.find(b => b.id === id);
    if (!target) return;
    const maxOther = Math.max(0, ...others.map(b => b.sort_order));
    if (target.sort_order > maxOther) return; // already in front
    // Same value the DB computes: highest sort_order among the user's buckets + 1
    const sortOrder = Math.max(target.sort_order, maxOther) + 1;
    setBuckets(prev => prev
      .map(b => b.id === id ? { ...b, sort_order: sortOrder } : b)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    try {
      await dbBringBucketToFront(id);
    } catch (error) {
      console.error('[FocusContext] Bring bucket to front failed, reverting UI:', error);
      await refreshData();
    }
  }, [buckets, refreshData]);

  const deleteBucket = useCallback(async (id: number) => {
    await dbDeleteBucket(id);
    await refreshData();
  }, [refreshData]);

  const updateObjectiveCategory = useCallback(async (id: number, categoryId: number | null) => {
    // Optimistic
    setObjectivePool(prev => prev.map(o => o.id === id ? { ...o, category_id: categoryId, last_interacted_at: new Date().toISOString() } : o));
    
    try {
      await dbUpdateObjectiveCategory(id, categoryId);
      await dbUpdateObjectiveInteractionTime(id);
    } catch (e) {
      console.error('Category update failed', e);
      await refreshData();
    }
  }, [refreshData]);

  const updateObjectiveDetails = useCallback(async (id: number, details: string | null) => {
    // Optimistic
    setObjectivePool(prev => prev.map(o => o.id === id ? { ...o, details, last_interacted_at: new Date().toISOString() } : o));
    
    try {
      await dbUpdateObjectiveDetails(id, details);
      await dbUpdateObjectiveInteractionTime(id);
    } catch (e) {
      console.error('Details update failed', e);
      await refreshData();
    }
  }, [refreshData]);

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

  // Optimistic like the objective reorder: the list jumps instantly, a failed write reloads from the DB
  const reorderCategories = useCallback(async (orderedIds: number[]) => {
    setCategories(prev => {
      const byId = new Map(prev.map(c => [c.id, c]));
      const reordered = orderedIds.map(id => byId.get(id)).filter((c): c is ObjectiveCategory => !!c);
      const rest = prev.filter(c => !orderedIds.includes(c.id));
      return [...reordered, ...rest].map((c, i) => ({ ...c, sort_order: i }));
    });
    try {
      await dbReorderCategories(orderedIds);
    } catch (e) {
      console.error('Category reorder failed', e);
      await refreshData();
    }
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
    const handleTimerSaved = async (e: Event) => {
      const customEvent = e as CustomEvent<{ durationSeconds: number; startTime: string; pauseTimes?: string[] }>;
      if (customEvent.detail && customEvent.detail.durationSeconds) {
        if (activeObjectiveId) {
          await dbUpdateObjectiveInteractionTime(activeObjectiveId);
        }
        await saveSession(
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
  }, [saveSession, activeObjectiveId]);

  return (
    <FocusContext.Provider value={{
      recentSessions,
      dailyStats,
      globalStats,
      objectivePool,
      activeObjectiveId,
      viewedObjectiveId,
      isGlitching,
      completedObjectiveText,
      categories,
      saveSession,
      refreshData,
      addObjective,
      deleteObjective,
      duplicateObjective,
      updateObjective,
      updateObjectiveCategory,
      updateObjectiveDetails,
      setActiveObjective,
      setViewedObjective,
      neutralizeObjective,
      reorderObjectives,
      missionObjectives,
      buckets,
      objectivesByBucket,
      setObjectiveMission,
      moveObjectiveToBucket,
      reorderBucketObjectives,
      addBucket,
      updateBucket,
      updateBucketGeometry,
      bringBucketToFront,
      deleteBucket,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
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
