import { type FC, useEffect, useRef } from 'react';
import styles from './SidebarRight.module.scss';
import { Terminal, Activity, Bell } from 'lucide-react';
import { useSystemLog } from '../hooks/useSystemLog';

export const SidebarRight: FC = () => {
  const { logs } = useSystemLog();
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <aside className={styles.sidebar}>
      <div className="card">
        <div className={styles.titleContainer}>
          <Terminal size={14} />
          <h4>SYSTEM_LOG</h4>
        </div>
        <div ref={logContainerRef} className={styles.logContainer}>
          {logs.map(log => (
            <div key={log.id} className={styles.logItem}>
              <span className={styles.timestamp}>{log.time}</span>
              <span className={`${styles.message} ${styles[log.type]}`}>{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="card">
        <div className={styles.titleContainer}>
          <Activity size={14} />
          <h4>ACTIVITY_MAP</h4>
        </div>
        <div className={styles.activityGrid}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div 
              key={i} 
              className={styles.cell} 
              style={{ opacity: Math.random() * 0.8 + 0.2 }}
            />
          ))}
        </div>
      </div>
      
      <div className="card">
        <div className={styles.titleContainer}>
          <Bell size={14} />
          <h4>NOTIFICATIONS</h4>
        </div>
        <div className={styles.notifItem}>
          NEW_SCHEMATIC_UNLOCKED
        </div>
      </div>
    </aside>
  );
};
