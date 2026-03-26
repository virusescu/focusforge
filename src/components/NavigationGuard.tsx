import { type FC } from 'react';
import styles from './NavigationGuard.module.scss';
import { AlertTriangle, ChevronRight, X } from 'lucide-react';

interface NavigationGuardProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const NavigationGuard: FC<NavigationGuardProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <AlertTriangle className={styles.warningIcon} size={20} />
            <span className={styles.title}>NAVIGATION_INTERRUPT // SESSION_AT_RISK</span>
          </div>
          <div className={styles.id}>ERROR_CODE: NAV_042</div>
        </div>

        <div className={styles.content}>
          <p className={styles.message}>
            A NEURAL FORGE IS CURRENTLY ACTIVE. LEAVING THE HUD WILL FORCE A 
            <span className={styles.highlight}> SESSION_SAVE</span> AND TERMINATE THE 
            CURRENT PROGRESSION.
          </p>
          <div className={styles.subtext}>
            DO YOU WISH TO PROCEED WITH DATA SYNC AND NAVIGATION?
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onCancel}>
            <X size={16} />
            <span>ABORT_NAVIGATION</span>
          </button>
          <button className={styles.btnConfirm} onClick={onConfirm}>
            <span>PROCEED_AND_SAVE</span>
            <ChevronRight size={16} />
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
