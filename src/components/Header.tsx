import { type FC, useState, useEffect, useCallback } from 'react';
import styles from './Header.module.scss';
import { Shield, Radio, Wifi, Settings } from 'lucide-react';
import { WindowControls } from './WindowControls';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import { useFocus } from '../contexts/FocusContext';
import { useGame } from '../contexts/GameContext';
import { getVersion } from '@tauri-apps/api/app';

function GameIndicators() {
  const { coins, currentStreakDays, season, seasonDaysRemaining, rewardToast } = useGame();

  return (
    <div className={styles.gameIndicators}>
      <span className={`${styles.coinCount} ${rewardToast ? styles.coinPulse : ''}`}>
        ⟐ {Math.floor(coins).toLocaleString()}
      </span>
      <div className={styles.streakBars}>
        {[0, 1, 2, 3].map(i => (
          <span
            key={i}
            className={`${styles.streakBar} ${i < currentStreakDays ? styles.streakFilled : ''} ${currentStreakDays >= 4 ? styles.streakComplete : ''}`}
          />
        ))}
      </div>
      {season && (
        <span className={`${styles.seasonTimer} ${seasonDaysRemaining <= 7 ? styles.seasonUrgent : ''}`}>
          S{season.season_number} · {seasonDaysRemaining}d
        </span>
      )}
    </div>
  );
}

interface HeaderProps {
  onOpenSettings: () => void;
  onViewVault: () => void;
}

export const Header: FC<HeaderProps> = ({ onOpenSettings, onViewVault }) => {
  const [appVersion, setAppVersion] = useState('...');
  const { timerStatus } = useFocus();
  const { currentTitle } = useGame();

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('dev'));
  }, []);

  const handleOpenSettings = useCallback(() => {
    soundEngine.playClick();
    onOpenSettings();
  }, [onOpenSettings]);

  const getStatusConfig = () => {
    switch (timerStatus) {
      case 'active':
        return { label: 'FORGING', className: styles.forging };
      case 'paused':
        return { label: 'FORGE_PAUSED', className: styles.paused };
      default:
        return { label: 'SYSTEM_READY', className: '' };
    }
  };

  const status = getStatusConfig();

  return (
    <header className={styles.header} data-tauri-drag-region>
      <div className={styles.left}>
        <div className={`${styles.status} ${status.className}`}>
          <div className={styles.dot} />
          <span>{status.label}</span>
        </div>
        <div className={styles.divider} />
        <button
          className={styles.rankBtn}
          onClick={() => { soundEngine.playClick(); onViewVault(); }}
          onMouseEnter={() => setStatusHint('VIEW_FORGE_VAULT')}
          onMouseLeave={clearStatusHint}
          title="Open Forge Vault"
        >
          <span className={styles.label}>PRESTIGE_RANK</span>
          <span className={styles.value}>{currentTitle?.display_name ?? 'UNRANKED'}</span>
        </button>
      </div>

      <div className={styles.center} data-tauri-drag-region>
        <div className={styles.title}>FOCUS_FORGE</div>
      </div>

      <div className={styles.right}>
        <GameIndicators />
        <div className={styles.divider} />
        <div className={styles.icons}>
          <Shield size={16} />
          <Radio size={16} />
          <Wifi size={16} />
        </div>
        <div className={styles.divider} />
        <div className={styles.version}>V-{appVersion}</div>
        <div className={styles.divider} />
        <button 
          className={styles.settingsBtn} 
          onClick={handleOpenSettings}
          title="SYSTEM_SETTINGS"
        >
          <Settings size={16} />
        </button>
        <div className={styles.divider} />
        <WindowControls />
      </div>

    </header>
  );
};
