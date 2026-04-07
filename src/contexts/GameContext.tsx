import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { GameSeason, GameState, ToolDefinition, PrestigeTitleDefinition, SeasonArchive, RewardToastData } from '../types';
import { useAuth } from './AuthContext';
import { soundEngine } from '../utils/audio';
import {
  calculateSessionReward,
  calculateObjectiveBounty,
  calculatePassiveIncomePerHour,
  getStreakExtendCost,
  getStreakMultiplier,
  getSeasonDaysRemaining,
  isWorkDay,
  getPreviousWorkDay,
  formatDateStr,
} from '../utils/gameEconomy';
import {
  initOrGetActiveSeason,
  getGameState,
  updateGameState,
  addCoinTransaction,
  getToolDefinitions,
  getOwnedTools,
  purchaseTool as dbPurchaseTool,
  getPrestigeTitles,
  getSeasonArchives,
  archiveSeason,
  initOrGetActiveSeason as createNewSeason,
  recordDailyActivity,
} from '../db';

interface GameContextType {
  // Season
  season: GameSeason | null;
  seasonDaysRemaining: number;

  // Economy
  coins: number;
  totalCoinsEarned: number;
  passiveIncomePerHour: number;
  activeMultiplierPercent: number;

  // Streak
  currentStreakDays: number;
  streaksCompletedThisSeason: number;
  streakMultiplier: number;

  // Daily challenge
  sessionsToday: number;
  dailyBonusActive: boolean;

  // Tools & prestige
  toolDefinitions: ToolDefinition[];
  ownedToolIds: Set<number>;
  prestigeTitles: PrestigeTitleDefinition[];
  currentTitle: PrestigeTitleDefinition | null;

  // Archives
  archives: SeasonArchive[];

  // UI state
  loading: boolean;
  rewardToast: RewardToastData | null;
  showSeasonTransition: boolean;

  // Actions
  purchaseTool: (toolId: number) => Promise<boolean>;
  extendStreak: () => Promise<boolean>;
  startNewSeason: () => Promise<void>;
  dismissRewardToast: () => void;
  refreshGameData: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuth();

  const [season, setSeason] = useState<GameSeason | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [toolDefinitions, setToolDefinitions] = useState<ToolDefinition[]>([]);
  const [ownedToolIds, setOwnedToolIds] = useState<Set<number>>(new Set());
  const [prestigeTitles, setPrestigeTitles] = useState<PrestigeTitleDefinition[]>([]);
  const [archives, setArchives] = useState<SeasonArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardToast, setRewardToast] = useState<RewardToastData | null>(null);
  const [showSeasonTransition, setShowSeasonTransition] = useState(false);

  const passiveAccumRef = useRef(0);
  const lastPassiveWriteRef = useRef(Date.now());

  // Derived values
  const coins = gameState?.coins ?? 0;
  const totalCoinsEarned = gameState?.total_coins_earned ?? 0;
  const streaksCompletedThisSeason = gameState?.streaks_completed ?? 0;
  const dailyBonusActive = (gameState?.daily_bonus_active ?? 0) === 1;

  // Effective streak: only show non-zero if streak was earned/extended today
  // The streak advances when daily challenge is completed, setting streak_last_date to today
  // If streak_last_date is from a previous day, show 0 — the handler will set it fresh
  const currentStreakDays = (() => {
    const raw = gameState?.current_streak_days ?? 0;
    if (raw === 0 || !gameState?.streak_last_date) return 0;
    const todayStr = formatDateStr(new Date());
    if (gameState.streak_last_date === todayStr) return raw;
    return 0;
  })();

  // Reset sessions_today if it's a stale date
  const sessionsToday = (() => {
    const todayStr = formatDateStr(new Date());
    if (gameState?.sessions_today_date !== todayStr) return 0;
    return gameState?.sessions_today ?? 0;
  })();

  const streakMultiplier = getStreakMultiplier(currentStreakDays);
  const seasonDaysRemaining = season ? getSeasonDaysRemaining(season.end_date) : 0;

  const ownedPassiveTools = toolDefinitions.filter(t => ownedToolIds.has(t.id) && (t.effect_type === 'passive' || t.effect_type === 'prestige'));
  const ownedActiveTools = toolDefinitions.filter(t => ownedToolIds.has(t.id) && (t.effect_type === 'active' || t.effect_type === 'prestige'));
  const passiveIncomePerHour = calculatePassiveIncomePerHour(ownedPassiveTools);
  const activeMultiplierPercent = ownedActiveTools.reduce((sum, t) => sum + t.active_percent, 0);

  // Current prestige title — highest unlocked based on total coins earned this season
  const currentTitle = [...prestigeTitles].reverse().find(t => totalCoinsEarned >= t.unlock_threshold) ?? null;

  // ─── Data Loading ───────────────────────────────────────────────

  const refreshGameData = useCallback(async () => {
    if (!authUser) return;
    try {
      const activeSeason = await initOrGetActiveSeason(authUser.id);
      setSeason(activeSeason);

      // Check if season has expired
      if (getSeasonDaysRemaining(activeSeason.end_date) <= 0) {
        setShowSeasonTransition(true);
      }

      const [state, tools, owned, titles, arcs] = await Promise.all([
        getGameState(authUser.id, activeSeason.id),
        getToolDefinitions(),
        getOwnedTools(authUser.id, activeSeason.id),
        getPrestigeTitles(),
        getSeasonArchives(authUser.id),
      ]);

      setGameState(state);
      setToolDefinitions(tools);
      setOwnedToolIds(new Set(owned));
      setPrestigeTitles(titles);
      setArchives(arcs);
    } catch (e) {
      console.error('Failed to load game data', e);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    refreshGameData();
  }, [refreshGameData]);

  // ─── Session Completion Listener ────────────────────────────────

  useEffect(() => {
    const handleTimerSaved = async (e: Event) => {
      if (!authUser || !season || !gameState) return;

      const detail = (e as CustomEvent<{ durationSeconds: number; startTime: string; pauseTimes?: string[] }>).detail;
      if (!detail || detail.durationSeconds < 60) return;

      const pauseCount = detail.pauseTimes?.length ?? 0;
      const todayStr = formatDateStr(new Date());

      // Reset sessions_today if it's a new day
      let currentSessionsToday = gameState.sessions_today;
      if (gameState.sessions_today_date !== todayStr) {
        currentSessionsToday = 0;
      }

      // Calculate reward
      const reward = calculateSessionReward({
        durationSeconds: detail.durationSeconds,
        pauseCount,
        currentStreakDays: gameState.current_streak_days,
        streaksCompletedThisSeason: gameState.streaks_completed,
        sessionsToday: currentSessionsToday,
        ownedActiveToolPercents: ownedActiveTools.map(t => t.active_percent),
      });

      // Persist coins
      await addCoinTransaction(authUser.id, season.id, reward.totalCoins, 'session_complete', JSON.stringify({
        duration: detail.durationSeconds,
        pauses: pauseCount,
        multipliers: {
          milestone: reward.milestoneMultiplier,
          pausePenalty: reward.pausePenalty,
          streak: reward.streakMultiplier,
          daily: reward.dailyBonusMultiplier,
          tools: reward.activeToolMultiplier,
        },
      }));

      // Only 30+ min sessions count toward daily challenge
      const newSessionsToday = reward.countsForProgress ? currentSessionsToday + 1 : currentSessionsToday;
      const dailyJustCompletedNow = reward.countsForProgress && currentSessionsToday < 3 && newSessionsToday >= 3;
      const dailyBonus = newSessionsToday >= 3 ? 1 : 0;

      // Streak logic — streak advances when daily challenge is COMPLETED (not per session)
      // Streak counts consecutive work-days where daily challenge was completed
      let newStreakDays = gameState.current_streak_days;
      let newStreaksCompleted = gameState.streaks_completed;
      let streakJustCompleted = false;
      const today = new Date();

      if (dailyJustCompletedNow && isWorkDay(today)) {
        // Daily challenge just completed — advance streak
        const prevWorkDay = getPreviousWorkDay(today);
        const prevWorkDayStr = formatDateStr(prevWorkDay);

        if (gameState.streak_last_date === prevWorkDayStr || gameState.streak_last_date === null || newStreakDays === 0) {
          newStreakDays = Math.min(newStreakDays + 1, 4);
        } else if (gameState.streak_last_date !== todayStr) {
          // Streak broken — restart at 1
          newStreakDays = 1;
        }

        if (newStreakDays >= 4) {
          newStreaksCompleted += 1;
          streakJustCompleted = true;
          newStreakDays = 0;
        }

        await recordDailyActivity(authUser.id, season.id, todayStr, newStreakDays);
      }

      await updateGameState(authUser.id, season.id, {
        sessions_today: newSessionsToday,
        sessions_today_date: todayStr,
        daily_bonus_active: dailyBonus,
        current_streak_days: newStreakDays,
        streak_last_date: dailyJustCompletedNow ? todayStr : (gameState.streak_last_date ?? undefined),
        streaks_completed: newStreaksCompleted,
      });

      // Play sounds
      soundEngine.playCoinEarned();
      if (reward.dailyChallengeJustCompleted) {
        setTimeout(() => soundEngine.playDailyBonusUnlocked(), 200);
      }
      if (streakJustCompleted) {
        setTimeout(() => soundEngine.playStreakMilestone(), 400);
      }

      // Show toast
      setRewardToast({
        baseCoins: reward.baseCoins,
        totalCoins: reward.totalCoins,
        durationMinutes: reward.durationMinutes,
        milestoneMultiplier: reward.milestoneMultiplier,
        milestoneName: reward.milestoneName,
        pausePenalty: reward.pausePenalty,
        streakMultiplier: reward.streakMultiplier,
        dailyBonusMultiplier: reward.dailyBonusMultiplier,
        activeToolMultiplier: reward.activeToolMultiplier,
        currentStreakDays: newStreakDays,
        sessionsToday: newSessionsToday,
        dailyChallengeJustCompleted: reward.dailyChallengeJustCompleted,
        streakJustCompleted,
      });

      await refreshGameData();
    };

    window.addEventListener('timer-saved', handleTimerSaved);
    return () => window.removeEventListener('timer-saved', handleTimerSaved);
  }, [authUser, season, gameState, ownedActiveTools, refreshGameData]);

  // ─── Objective Neutralized Listener ─────────────────────────────

  useEffect(() => {
    const handleObjectiveNeutralized = async (e: Event) => {
      if (!authUser || !season || !gameState) return;

      const { baseBounty } = (e as CustomEvent<{ baseBounty: number }>).detail;

      const reward = calculateObjectiveBounty({
        baseBounty,
        currentStreakDays: gameState.current_streak_days,
        ownedActiveToolPercents: ownedActiveTools.map(t => t.active_percent),
      });

      await addCoinTransaction(authUser.id, season.id, reward.totalCoins, 'objective_complete', JSON.stringify({
        baseBounty: reward.baseBounty,
        multipliers: { streak: reward.streakMultiplier, tools: reward.activeToolMultiplier },
      }));

      soundEngine.playCoinEarned();

      setRewardToast({
        baseCoins: reward.baseBounty,
        totalCoins: reward.totalCoins,
        durationMinutes: 0,
        milestoneMultiplier: 1,
        milestoneName: 'NONE',
        pausePenalty: 0,
        streakMultiplier: reward.streakMultiplier,
        dailyBonusMultiplier: 1,
        activeToolMultiplier: reward.activeToolMultiplier,
        currentStreakDays: gameState.current_streak_days,
        sessionsToday: gameState.sessions_today,
        dailyChallengeJustCompleted: false,
        streakJustCompleted: false,
        objectiveBounty: {
          baseBounty: reward.baseBounty,
          streakMultiplier: reward.streakMultiplier,
          activeToolMultiplier: reward.activeToolMultiplier,
        },
      });

      await refreshGameData();
    };

    window.addEventListener('objective-neutralized', handleObjectiveNeutralized);
    return () => window.removeEventListener('objective-neutralized', handleObjectiveNeutralized);
  }, [authUser, season, gameState, ownedActiveTools, refreshGameData]);

  // ─── Passive Income Tick ────────────────────────────────────────

  useEffect(() => {
    if (!authUser || !season || passiveIncomePerHour <= 0) return;

    const interval = setInterval(async () => {
      const perMinute = passiveIncomePerHour / 60;
      passiveAccumRef.current += perMinute;

      // Write to DB every 5 minutes
      const now = Date.now();
      if (now - lastPassiveWriteRef.current >= 5 * 60 * 1000 && passiveAccumRef.current > 0) {
        const amount = Math.round(passiveAccumRef.current * 100) / 100;
        await addCoinTransaction(authUser.id, season.id, amount, 'passive_income');
        passiveAccumRef.current = 0;
        lastPassiveWriteRef.current = now;
        await refreshGameData();
      }
    }, 60 * 1000); // Every minute

    return () => clearInterval(interval);
  }, [authUser, season, passiveIncomePerHour, refreshGameData]);

  // ─── Actions ────────────────────────────────────────────────────

  const purchaseTool = useCallback(async (toolId: number): Promise<boolean> => {
    if (!authUser || !season) return false;
    const tool = toolDefinitions.find(t => t.id === toolId);
    if (!tool || coins < tool.cost || ownedToolIds.has(toolId)) return false;

    try {
      await dbPurchaseTool(authUser.id, season.id, toolId, tool.cost);
      soundEngine.playPurchase();
      await refreshGameData();
      return true;
    } catch {
      return false;
    }
  }, [authUser, season, toolDefinitions, coins, ownedToolIds, refreshGameData]);

  const extendStreak = useCallback(async (): Promise<boolean> => {
    if (!authUser || !season || !gameState) return false;
    const cost = getStreakExtendCost(currentStreakDays);
    if (coins < cost) return false;

    try {
      await addCoinTransaction(authUser.id, season.id, -cost, 'streak_extend');
      await updateGameState(authUser.id, season.id, {
        current_streak_days: Math.max(currentStreakDays, 1),
        streak_last_date: formatDateStr(getPreviousWorkDay(new Date())),
      });
      soundEngine.playClick();
      await refreshGameData();
      return true;
    } catch {
      return false;
    }
  }, [authUser, season, gameState, currentStreakDays, coins, refreshGameData]);

  const startNewSeason = useCallback(async () => {
    if (!authUser || !season) return;

    // Archive current season
    await archiveSeason(authUser.id, season.id);

    // Flush passive income
    if (passiveAccumRef.current > 0) {
      await addCoinTransaction(authUser.id, season.id, Math.round(passiveAccumRef.current * 100) / 100, 'passive_income');
      passiveAccumRef.current = 0;
    }

    // Create new season (initOrGetActiveSeason will make a new one since old one is deactivated)
    await createNewSeason(authUser.id);
    setShowSeasonTransition(false);
    await refreshGameData();
  }, [authUser, season, refreshGameData]);

  const dismissRewardToast = useCallback(() => {
    setRewardToast(null);
  }, []);

  return (
    <GameContext.Provider value={{
      season,
      seasonDaysRemaining,
      coins,
      totalCoinsEarned,
      passiveIncomePerHour,
      activeMultiplierPercent,
      currentStreakDays,
      streaksCompletedThisSeason,
      streakMultiplier,
      sessionsToday,
      dailyBonusActive,
      toolDefinitions,
      ownedToolIds,
      prestigeTitles,
      currentTitle,
      archives,
      loading,
      rewardToast,
      showSeasonTransition,
      purchaseTool,
      extendStreak,
      startNewSeason,
      dismissRewardToast,
      refreshGameData,
    }}>
      {children}
    </GameContext.Provider>
  );
};

// Default values used when game data hasn't loaded yet
const defaultGameContext: GameContextType = {
  season: null,
  seasonDaysRemaining: 0,
  coins: 0,
  totalCoinsEarned: 0,
  passiveIncomePerHour: 0,
  activeMultiplierPercent: 0,
  currentStreakDays: 0,
  streaksCompletedThisSeason: 0,
  streakMultiplier: 1,
  sessionsToday: 0,
  dailyBonusActive: false,
  toolDefinitions: [],
  ownedToolIds: new Set(),
  prestigeTitles: [],
  currentTitle: null,
  archives: [],
  loading: true,
  rewardToast: null,
  showSeasonTransition: false,
  purchaseTool: async () => false,
  extendStreak: async () => false,
  startNewSeason: async () => {},
  dismissRewardToast: () => {},
  refreshGameData: async () => {},
};

export const useGame = () => {
  const context = useContext(GameContext);
  // Return safe defaults instead of throwing — prevents app crash if GameProvider has issues
  if (context === undefined) {
    return defaultGameContext;
  }
  return context;
};
