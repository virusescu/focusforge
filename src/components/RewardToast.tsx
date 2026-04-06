import { type FC, useEffect, useState, useRef } from 'react';
import styles from './RewardToast.module.scss';
import { useGame } from '../contexts/GameContext';

export const RewardToast: FC = () => {
  const { rewardToast, dismissRewardToast } = useGame();
  const [displayedCoins, setDisplayedCoins] = useState(0);
  const [exiting, setExiting] = useState(false);
  const animRef = useRef<number>(0);

  // Count-up animation
  useEffect(() => {
    if (!rewardToast) {
      setDisplayedCoins(0);
      return;
    }

    const target = rewardToast.totalCoins;
    const duration = 400;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayedCoins(Math.round(target * progress));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [rewardToast]);

  // Auto-dismiss
  useEffect(() => {
    if (!rewardToast) return;
    const exitTimer = setTimeout(() => setExiting(true), 3000);
    const dismissTimer = setTimeout(() => {
      dismissRewardToast();
      setExiting(false);
    }, 3500);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [rewardToast, dismissRewardToast]);

  if (!rewardToast) return null;

  return (
    <div className={`${styles.toast} ${exiting ? styles.exiting : ''}`}>
      <div className={styles.title}>SESSION_COMPLETE</div>
      <div className={styles.coinLine}>
        <span className={styles.coinAmount}>+{displayedCoins} ⟐</span>
        {rewardToast.milestoneMultiplier > 1 && (
          <span className={styles.bonusTag}>{rewardToast.milestoneMultiplier}x {rewardToast.milestoneName}</span>
        )}
      </div>
      <div className={styles.multiplierLine}>
        {rewardToast.durationMinutes}m × {rewardToast.milestoneMultiplier}x
        {rewardToast.pausePenalty > 0 && (
          <span className={styles.penaltyTag}> −{(rewardToast.pausePenalty * 100).toFixed(0)}% pauses</span>
        )}
        {rewardToast.activeToolMultiplier > 1 && (
          <span> · TOOLS +{Math.round((rewardToast.activeToolMultiplier - 1) * 100)}%</span>
        )}
      </div>
      <div className={styles.streakLine}>
        STREAK: DAY {rewardToast.currentStreakDays}/4
        {rewardToast.streakJustCompleted && (
          <span className={styles.streakComplete}> — STREAK_COMPLETE!</span>
        )}
      </div>
      <div className={`${styles.dailyLine} ${rewardToast.dailyChallengeJustCompleted ? styles.dailyComplete : ''}`}>
        DAILY: {rewardToast.sessionsToday}/3 SESSIONS
        {rewardToast.dailyChallengeJustCompleted && (
          <span> — 2x BONUS_UNLOCKED</span>
        )}
      </div>
    </div>
  );
};
