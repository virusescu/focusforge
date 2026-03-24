import { type FC } from 'react';
import { X, Minus } from 'lucide-react';
import styles from './WindowControls.module.scss';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export const WindowControls: FC = () => {
  const handleMinimize = async () => {
    await appWindow.minimize();
  };

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
        onClick={handleClose} 
        className={`${styles.button} ${styles.close}`}
        title="TERMINATE_PROCESS"
      >
        <X size={14} />
      </button>
    </div>
  );
};
