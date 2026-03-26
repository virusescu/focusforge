import { type FC, useState, useCallback } from 'react';
import styles from './Header.module.scss';
import { Shield, Radio, Wifi, Settings } from 'lucide-react';
import { WindowControls } from './WindowControls';
import { SettingsModal } from './SettingsModal';
import { soundEngine } from '../utils/audio';
import { useFocus } from '../contexts/FocusContext';

export const Header: FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { timerStatus } = useFocus();

  const handleOpenSettings = useCallback(() => {
    soundEngine.playClick();
    setIsSettingsOpen(true);
  }, []);

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
        <div className={styles.rank}>
          <span className={styles.label}>OPERATOR_RANK</span>
          <span className={styles.value}>LEAD_ENGINEER</span>
        </div>
      </div>

      <div className={styles.center} data-tauri-drag-region>
        <div className={styles.title}>FOCUS_FORGE</div>
      </div>

      <div className={styles.right}>
        <div className={styles.icons}>
          <Shield size={16} />
          <Radio size={16} />
          <Wifi size={16} />
        </div>
        <div className={styles.divider} />
        <div className={styles.version}>V-0.0.69</div>
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

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </header>
  );
};
