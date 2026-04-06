import { type FC, useEffect, useRef } from 'react';
import styles from './SeasonTransitionModal.module.scss';
import { useGame } from '../contexts/GameContext';
import { soundEngine } from '../utils/audio';
import { getSeasonLabel, getSeasonName, getSeasonBadgeColor, getQuarter } from '../utils/gameEconomy';

export const SeasonTransitionModal: FC = () => {
  const { showSeasonTransition, season, coins, totalCoinsEarned, streaksCompletedThisSeason, startNewSeason } = useGame();
  const playedRef = useRef(false);

  useEffect(() => {
    if (showSeasonTransition && !playedRef.current) {
      playedRef.current = true;
      soundEngine.playSeasonComplete();
    }
    if (!showSeasonTransition) {
      playedRef.current = false;
    }
  }, [showSeasonTransition]);

  if (!showSeasonTransition || !season) return null;

  const label = getSeasonLabel(season.season_number, season.year);
  const name = getSeasonName(season.season_number);
  const badgeColor = getSeasonBadgeColor(season.season_number);
  const nextQuarter = (season.season_number % 4) + 1;
  const nextYear = nextQuarter === 1 ? season.year + 1 : season.year;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>SEASON_COMPLETE</div>

        <div className={styles.badge} style={{ borderColor: badgeColor, color: badgeColor }}>
          ◆ {label} — "{name}" ◆
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{Math.floor(totalCoinsEarned).toLocaleString()}</span>
            <span className={styles.statLabel}>TOTAL_COINS</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{Math.floor(coins).toLocaleString()}</span>
            <span className={styles.statLabel}>FINAL_BALANCE</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{streaksCompletedThisSeason}</span>
            <span className={styles.statLabel}>STREAKS</span>
          </div>
        </div>

        <div className={styles.message}>
          YOUR FORGE HAS BEEN ARCHIVED.<br />
          A NEW SEASON AWAITS.
        </div>

        <button className={styles.cta} onClick={startNewSeason}>
          BEGIN S{nextQuarter} {nextYear}
        </button>
      </div>
    </div>
  );
};
