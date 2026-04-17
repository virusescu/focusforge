import { type FC, useState, useEffect } from 'react';
import styles from './Footer.module.scss';
import { Lock, Server, Cpu } from 'lucide-react';
import { useStatusHint } from '../utils/statusHint';
import { formatNowWithWeekday } from '../utils/dateUtils';

export const Footer: FC = () => {
  const hint = useStatusHint();
  const [clock, setClock] = useState(formatNowWithWeekday);

  useEffect(() => {
    const id = setInterval(() => setClock(formatNowWithWeekday()), 1000);
    return () => clearInterval(id);
  }, []);

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
      <div className={styles.time}>{clock}</div>
    </footer>
  );
};
