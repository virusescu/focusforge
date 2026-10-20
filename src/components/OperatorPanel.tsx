import { type FC } from 'react';
import { User, Zap, Flame, Star } from 'lucide-react';
import styles from './OperatorPanel.module.scss';
import { useUser } from '../contexts/UserContext';
import { useGame } from '../contexts/GameContext';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';

interface OperatorPanelProps {
  onOpenSettings: () => void;
}

export const OperatorPanel: FC<OperatorPanelProps> = ({ onOpenSettings }) => {
  const { name, avatar } = useUser();
  const { sessionsToday, dailyBonusActive, currentStreakDays, streakMultiplier, totalCoinsEarned, prestigeTitles, currentTitle } = useGame();

  // Progress from the current prestige threshold to the next one
  const nextTitle = currentTitle
    ? prestigeTitles.find(t => t.unlock_threshold > currentTitle.unlock_threshold)
    : prestigeTitles[0];
  const levelFrom = currentTitle?.unlock_threshold ?? 0;
  const levelTo = nextTitle?.unlock_threshold ?? 60000;
  const levelProgress = Math.min(Math.max((totalCoinsEarned - levelFrom) / (levelTo - levelFrom), 0), 1);

  const combinedMultiplier = streakMultiplier * (dailyBonusActive ? 2.0 : 1.0);
  const isBaseMultiplier = combinedMultiplier <= 1;

  return (
    <div className="card">
      <div
        className={styles.operatorCard}
        onClick={onOpenSettings}
        onMouseEnter={() => setStatusHint('OPEN_SETTINGS')}
        onMouseLeave={clearStatusHint}
      >
        <div className={styles.avatar}>
          {avatar ? (
            <img src={avatar} alt="User Avatar" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
          ) : (
            <User size={32} />
          )}
        </div>
        <div className={styles.details}>
          <h3>{name || 'LOADING...'}</h3>
          <p>SYNC_STABLE</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.multiplierRow}>
          <div className={`${styles.multiplierDisplay} ${isBaseMultiplier ? styles.multiplierInactive : ''}`}>
            <span className={styles.multiplierValue}>{isBaseMultiplier ? '—' : `${combinedMultiplier.toFixed(2)}x`}</span>
            <span className={styles.multiplierLabel}>MULTIPLIER</span>
          </div>
          <div className={styles.compactStats}>
            <div className={styles.compactItem}>
              <div className={styles.compactInfo}>
                <Zap size={10} />
                <span>DAILY</span>
                <span className={styles.compactValue}>{dailyBonusActive ? '2x' : `${Math.min(sessionsToday, 3)}/3`}</span>
              </div>
              <div className={styles.progressBar}>
                <div className={`${styles.progressFill} ${dailyBonusActive ? styles.progressActive : ''}`} style={{ width: `${Math.min(sessionsToday / 3, 1) * 100}%` }} />
              </div>
            </div>
            <div className={styles.compactItem}>
              <div className={styles.compactInfo}>
                <Flame size={10} />
                <span>STREAK</span>
                <span className={styles.compactValue}>{currentStreakDays}/4</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${(currentStreakDays / 4) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div
          className={styles.statItem}
          title={`Total: ${Math.floor(totalCoinsEarned).toLocaleString()} / 60,000 ⟐`}
        >
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>
              <Star size={12} />
              <span>FORGE_PROGRESS</span>
            </div>
            <span className={styles.statValue}>
              {nextTitle
                ? `${Math.floor(totalCoinsEarned - levelFrom).toLocaleString()} / ${(levelTo - levelFrom).toLocaleString()}`
                : 'MAX'}
            </span>
          </div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${levelProgress * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
