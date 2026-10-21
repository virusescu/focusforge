import { type FC, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';
import styles from './WindowControls.module.scss';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export const WindowControls: FC = () => {
  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize();
  };

  // F11 toggles maximize from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F11') return;
      e.preventDefault();
      void appWindow.toggleMaximize();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <div className={styles.controls}>
      <button 
        onClick={handleMinimize} 
        className={styles.button}
        title="MINIMIZE_SYSTEM"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={handleToggleMaximize}
        className={styles.button}
        title="MAXIMIZE_SYSTEM (F11)"
      >
        <Square size={12} />
      </button>
      <button 
        onClick={handleClose} 
        className={`${styles.button} ${styles.close}`}
        title="TERMINATE_PROCESS"
      >
        <X size={14} />
      </button>
    </div>
  );
};
