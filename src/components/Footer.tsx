import { type FC } from 'react';
import styles from './Footer.module.scss';
import { Lock, Server, Cpu } from 'lucide-react';
import { useStatusHint } from '../utils/statusHint';

export const Footer: FC = () => {
  const hint = useStatusHint();

  return (
    <footer className={styles.footer}>
      <div className={styles.stat}>
        <Lock size={12} />
        <span>AES-256_ENCRYPTED</span>
      </div>
      <div className={styles.stat}>
        <Server size={12} />
        <span>LOCAL_INSTANCE</span>
      </div>
      <div className={styles.stat}>
        <Cpu size={12} />
        <span>NEURAL_ENGINE: ACTIVE</span>
      </div>
      <div className={styles.spacer} />
      {hint && <div className={styles.hint}>{hint}</div>}
      <div className={styles.time}>
        2026-03-20 14:32:45
      </div>
    </footer>
  );
};
