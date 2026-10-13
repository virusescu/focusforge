import { type FC, useEffect, useState } from 'react';
import styles from './VaultPage.module.scss';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';
import { useGame } from '../contexts/GameContext';
import { soundEngine } from '../utils/audio';

interface Props {
  onBack: () => void;
}

export const VaultPage: FC<Props> = ({ onBack }) => {
  const {
    season,
    seasonDaysRemaining,
    coins,
    totalCoinsEarned,
    currentStreakDays,
    streaksCompletedThisSeason,
    streakMultiplier,
    sessionsToday,
    dailyBonusActive,
    prestigeTitles,
    currentTitle,
    archives,
  } = useGame();

  const [expandedArchiveId, setExpandedArchiveId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const handleHover = () => soundEngine.playHover();

  return (
    <div className={styles.vault}>
      {/* Header */}
      <div className={styles.vaultHeader}>
        <button className={styles.backBtn} onClick={onBack} onMouseEnter={handleHover}>
          <ArrowLeft size={16} />
          <span>BACK_TO_HUD</span>
        </button>
        <div className={styles.vaultTitle}>
          FORGE_VAULT
          {season && <span className={styles.seasonBadge}>S{season.season_number} {season.year}</span>}
          <button
            className={`${styles.helpToggle} ${showHelp ? styles.helpActive : ''}`}
            onClick={() => { setShowHelp(!showHelp); soundEngine.playClick(); }}
            onMouseEnter={handleHover}
            title="ECONOMY_INFO"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className={styles.helpOverlay}>
          <div className={styles.helpPanel}>
            <div className={styles.helpHeader}>
              <span>FORGE_ECONOMY // OPERATOR_MANUAL</span>
              <button className={styles.helpClose} onClick={() => { setShowHelp(false); soundEngine.playClick(); }}>
                <X size={14} />
              </button>
            </div>

            <div className={styles.helpBody}>
              <div className={styles.helpSection}>
                <h4>EARNING_COINS</h4>
                <div className={styles.helpItem}>
                  <strong>BASE_REWARD:</strong> Every minute of focus earns <span className={styles.helpCoin}>1 ⟐</span>. A 30-minute session = 30 base coins. Every minute counts.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>DURATION_MILESTONES</h4>
                <div className={styles.helpItem}>
                  <strong>15 MIN — FOCUS_LOCKED (1.2x):</strong> Cross the first marker. All coins earned this session get a 20% boost.
                </div>
                <div className={styles.helpItem}>
                  <strong>30 MIN — DEEP_FOCUS (1.5x):</strong> Cross the second marker. 50% boost on all session coins.
                </div>
                <div className={styles.helpItem}>
                  <strong>60 MIN — SUPER_FORGE (2.0x):</strong> Enter the super phase. Double all session coins. This is where real progression happens.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>PAUSE_PENALTY</h4>
                <div className={styles.helpItem}>
                  Each pause during a session reduces your milestone multiplier by 5% (−0.05x per pause). The multiplier can't drop below 0.5x. Stay unbroken for maximum yield.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>STACKING_MULTIPLIERS</h4>
                <div className={styles.helpItem}>
                  <strong>DAILY_CHALLENGE (2x):</strong> Complete 3 qualifying sessions (30+ min each) in a single day to unlock a 2x multiplier on ALL coins earned that day. Resets at midnight. Shorter sessions still earn coins but don't count toward the challenge.
                </div>
                <div className={styles.helpItem}>
                  <strong>STREAK (1.0x → 3.0x):</strong> Counts consecutive work-days (Mon–Fri) where you completed the daily challenge. Day 1 = 1.25x, Day 2 = 1.5x, Day 3 = 2.0x, Day 4 = 3.0x, then resets. Missing a daily challenge breaks the streak.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>PRESTIGE_RANK</h4>
                <div className={styles.helpItem}>
                  As you earn coins throughout the season, you unlock prestige titles automatically. These are based on your <strong>total coins earned</strong> (not current balance — spending doesn't lose rank). 12 tiers from Initiate (5,000 ⟐) to Singularity (<span className={styles.helpCoin}>60,000 ⟐</span>). Prestige resets each season.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>SEASONS</h4>
                <div className={styles.helpItem}>
                  Each quarter (3 months) is one season. At season end, your stats are archived with a seasonal badge. Everything resets — coins, streaks, prestige rank — but your archive persists forever.
                </div>
              </div>

              <div className={styles.helpSection}>
                <h4>EXAMPLE</h4>
                <div className={styles.helpItem}>
                  A 50-minute unbroken session on streak day 3 with the daily bonus active:<br />
                  50 min × 1.5x (DEEP_FOCUS) × 2.0x (streak day 3) × 2.0x (daily) = <span className={styles.helpCoin}>300 ⟐</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Season Overview */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>SEASON_OVERVIEW</h3>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewStat}>
            <span className={styles.coinDisplay}>⟐ {Math.floor(coins).toLocaleString()}</span>
            <span className={styles.overviewLabel}>COINS</span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewValue}>{Math.floor(totalCoinsEarned).toLocaleString()}</span>
            <span className={styles.overviewLabel}>TOTAL_EARNED</span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewValue}>{streaksCompletedThisSeason}</span>
            <span className={styles.overviewLabel}>STREAKS</span>
          </div>
          <div className={styles.overviewStat}>
            <span className={styles.overviewValue}>{seasonDaysRemaining}d</span>
            <span className={styles.overviewLabel}>REMAINING</span>
          </div>
        </div>

        <div className={styles.subCards}>
          {/* Daily Challenge */}
          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>DAILY_CHALLENGE</div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.min(sessionsToday / 3, 1) * 100}%` }} />
            </div>
            <div className={styles.subCardInfo}>
              SESSIONS: {sessionsToday}/3
              <span className={dailyBonusActive ? styles.bonusActive : styles.bonusLocked}>
                {dailyBonusActive ? '2x ACTIVE' : 'LOCKED'}
              </span>
            </div>
          </div>

          {/* Streak Status */}
          <div className={styles.subCard}>
            <div className={styles.subCardTitle}>STREAK_STATUS</div>
            <div className={styles.streakDisplay}>
              <div className={styles.streakBarsLarge}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`${styles.streakBarLg} ${i < currentStreakDays ? styles.streakBarFilled : ''}`} />
                ))}
              </div>
              <span className={styles.streakMult}>{streakMultiplier.toFixed(2)}x</span>
            </div>
          </div>

        </div>
      </section>

      {/* Prestige Ranks */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>PRESTIGE_RANK</h3>

        {/* Current title hero */}
        <div className={styles.prestigeHero}>
          <div className={styles.prestigeHeroIcon}>
            {currentTitle ? currentTitle.icon : '🔒'}
          </div>
          <div className={styles.prestigeHeroInfo}>
            <div className={styles.prestigeHeroName}>
              {currentTitle ? currentTitle.display_name.toUpperCase() : 'UNRANKED'}
            </div>
            <div className={styles.prestigeHeroDesc}>
              {currentTitle ? currentTitle.description : 'Complete sessions to earn coins and unlock your first rank'}
            </div>
            {(() => {
              const nextTitle = currentTitle
                ? prestigeTitles.find(t => t.unlock_threshold > (currentTitle?.unlock_threshold ?? 0))
                : prestigeTitles[0];
              if (!nextTitle) return (
                <div className={styles.prestigeHeroMaxed}>MAXIMUM RANK ACHIEVED</div>
              );
              const prevThreshold = currentTitle?.unlock_threshold ?? 0;
              const progress = Math.min(
                Math.max((totalCoinsEarned - prevThreshold) / (nextTitle.unlock_threshold - prevThreshold), 0),
                1
              );
              return (
                <div className={styles.prestigeHeroProgress}>
                  <div className={styles.prestigeProgressTrack}>
                    <div className={styles.prestigeProgressFill} style={{ width: `${progress * 100}%` }} />
                  </div>
                  <span className={styles.prestigeProgressLabel}>
                    {Math.floor(totalCoinsEarned).toLocaleString()} / {nextTitle.unlock_threshold.toLocaleString()} ⟐ → {nextTitle.display_name}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 4×3 prestige grid */}
        <div className={styles.prestigeGrid}>
          {prestigeTitles.map(title => {
            const unlocked = totalCoinsEarned >= title.unlock_threshold;
            const isCurrent = currentTitle?.id === title.id;
            return (
              <div
                key={title.id}
                className={`${styles.prestigeTile} ${unlocked ? styles.prestigeTileUnlocked : styles.prestigeTileLocked} ${isCurrent ? styles.prestigeTileCurrent : ''}`}
              >
                <div className={styles.prestigeTileIcon}>{unlocked ? title.icon : '🔒'}</div>
                <div className={styles.prestigeTileName}>{title.display_name}</div>
                <div className={styles.prestigeTileThreshold}>
                  {unlocked ? '✓ UNLOCKED' : `${title.unlock_threshold.toLocaleString()} ⟐`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Seasonal Archive */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>SEASONAL_ARCHIVE</h3>
        {archives.length === 0 ? (
          <div className={styles.emptyState}>
            NO_ARCHIVED_SEASONS — Complete your first season to see it here.
          </div>
        ) : (
          <div className={styles.archiveRow}>
            {archives.map(archive => (
              <div key={archive.id} className={styles.archiveCard}>
                <div className={styles.archiveBadge} style={{ borderColor: archive.badge_color, color: archive.badge_color }}>
                  ◆ {archive.season_label}
                </div>
                <div className={styles.archiveName}>"{archive.season_name}"</div>
                <div className={styles.archiveStats}>
                  <span>{Math.floor(archive.total_coins_earned).toLocaleString()} ⟐</span>
                  <span>{archive.total_sessions} sessions</span>
                  <span>{archive.total_streaks} streaks</span>
                </div>
                <button
                  className={styles.archiveDetailBtn}
                  onClick={() => {
                    setExpandedArchiveId(expandedArchiveId === archive.id ? null : archive.id);
                    soundEngine.playClick();
                  }}
                  onMouseEnter={handleHover}
                >
                  {expandedArchiveId === archive.id ? 'HIDE_DETAILS' : 'VIEW_DETAILS'}
                </button>
                {expandedArchiveId === archive.id && (
                  <div className={styles.archiveExpanded}>
                    <div className={styles.archiveDetailRow}>
                      <span>FINAL_BALANCE:</span>
                      <span>{Math.floor(archive.final_coins).toLocaleString()} ⟐</span>
                    </div>
                    <div className={styles.archiveDetailRow}>
                      <span>PEAK_COINS/HR:</span>
                      <span>{archive.peak_coins_per_hour.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
