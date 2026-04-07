import { useState, type FC } from 'react';
import { Download, X, Zap } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import styles from './UpdatePrompt.module.scss';

interface UpdatePromptProps {
  update: Update;
  onSkip: () => void;
}

export const UpdatePrompt: FC<UpdatePromptProps> = ({ update, onSkip }) => {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await update.downloadAndInstall();
    await relaunch();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Zap className={styles.icon} size={20} />
            <span className={styles.title}>SYSTEM_UPDATE // NEW_VERSION_DETECTED</span>
          </div>
          <div className={styles.id}>SYS: v{update.version}</div>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            FORGE_UPDATE <span className={styles.highlight}>v{update.version}</span> IS READY FOR DEPLOYMENT.
            INSTALL NOW TO RECEIVE THE LATEST SYSTEM PATCHES.
          </p>
          {update.body && (
            <div className={styles.notes}>{update.body}</div>
          )}
          <div className={styles.subtext}>
            THE APP WILL RESTART AUTOMATICALLY AFTER INSTALLATION.
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSkip} onClick={onSkip} disabled={installing}>
            <X size={16} />
            <span>SKIP_UPDATE</span>
          </button>
          <button className={styles.btnInstall} onClick={handleInstall} disabled={installing}>
            <Download size={16} />
            <span>{installing ? 'INSTALLING...' : 'INSTALL_NOW'}</span>
          </button>
        </div>

        <div className={styles.decoration}>
          <div className={styles.line} />
          <div className={styles.dots}>
            {[...Array(4)].map((_, i) => <div key={i} className={styles.dot} />)}
          </div>
        </div>
      </div>
    </div>
  );
};
