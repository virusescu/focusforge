import { type FC, useState, useEffect, useRef } from 'react';
import styles from './SidebarRight.module.scss';
import { Terminal, Activity, Bell } from 'lucide-react';
import { LOG_MESSAGES } from '../logData';

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: string;
}

export const SidebarRight: FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', time: new Date().toLocaleTimeString([], { hour12: false }), msg: 'SYSTEM_READY', type: 'info' }
  ]);
  const [isActive, setIsActive] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (category: keyof typeof LOG_MESSAGES, type: string = 'info') => {
    const pool = LOG_MESSAGES[category];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      time: new Date().toLocaleTimeString([], { hour12: false }),
      msg,
      type
    };
    setLogs(prev => [...prev, newLog].slice(-100));
  };

  useEffect(() => {
    const onStart = () => {
      setIsActive(true);
      addLog('START', 'success');
    };
    const onPause = () => {
      setIsActive(false);
      addLog('HALT', 'warning');
    };
    const onReset = () => {
      setIsActive(false);
      addLog('REBOOT', 'info');
    };

    window.addEventListener('timer-active', onStart);
    window.addEventListener('timer-paused', onPause);
    window.addEventListener('timer-reset', onReset);
    return () => {
      window.removeEventListener('timer-active', onStart);
      window.removeEventListener('timer-paused', onPause);
      window.removeEventListener('timer-reset', onReset);
    };
  }, []);

  useEffect(() => {
    let timeout: number;
    const tick = () => {
      if (isActive) {
        addLog('IDLE', 'info');
      }
      const delay = Math.random() * 400; // 0-0.4s
      timeout = setTimeout(tick, delay) as unknown as number;
    };
    timeout = setTimeout(tick, 400) as unknown as number;
    return () => clearTimeout(timeout);
  }, [isActive]);

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
