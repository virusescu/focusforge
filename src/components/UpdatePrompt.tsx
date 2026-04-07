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
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    let downloaded = 0;
    let contentLength = 0;

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error('Update failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setInstalling(false);
    }
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
          
          {error && (
            <div style={{ color: '#ff4444', background: 'rgba(255,0,0,0.1)', padding: '0.75rem', marginBottom: '1rem', borderLeft: '2px solid #ff4444', fontFamily: 'monospace', fontSize: '0.7rem' }}>
              ERROR: {error.toUpperCase()}
            </div>
          )}

          {update.body && !error && (
            <div className={styles.notes}>{update.body}</div>
          )}
          
          {installing && (
            <div className={styles.progressContainer}>
              <div className={styles.progressLabel}>
                <span>DOWNLOADING_SYSTEM_FILES...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${downloadProgress}%` }} 
                />
              </div>
            </div>
          )}

          <div className={styles.subtext}>
            {installing ? 'PLEASE WAIT while the system applies patches...' : 'THE APP WILL RESTART AUTOMATICALLY AFTER INSTALLATION.'}
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
