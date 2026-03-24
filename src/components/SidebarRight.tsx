import { type FC, useEffect, useRef, useState } from 'react';
import styles from './SidebarRight.module.scss';
import { Terminal, Activity, History } from 'lucide-react';
import { useSystemLog } from '../hooks/useSystemLog';
import { useFocus } from '../contexts/FocusContext';

export const SidebarRight: FC = () => {
  const { logs } = useSystemLog();
  const { dailyStats, recentSessions } = useFocus();
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [hoveredCell, setHoveredCell] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Heatmap generation logic
  const days = 21;
  const today = new Date();
  const heatmapCells = Array.from({ length: days }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const stat = dailyStats.find(s => s.date === dateStr);
    const totalSeconds = stat ? stat.totalSeconds : 0;
    const minutes = totalSeconds / 60;
    
    let colorClass = styles.cellBlack;
    if (minutes > 0 && minutes < 120) colorClass = styles.cellBrown;
    else if (minutes >= 120 && minutes < 240) colorClass = styles.cellOrange;
    else if (minutes >= 240) colorClass = styles.cellBrightOrange;

    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

    return {
      date: dateStr,
      minutes,
      colorClass,
      formattedTime: timeStr
    };
  });

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
      
      <div className="card" style={{ position: 'relative' }}>
        <div className={styles.titleContainer}>
          <Activity size={14} />
          <h4>ACTIVITY_MAP</h4>
        </div>
        <div className={styles.activityGrid}>
          {heatmapCells.map((cell, i) => (
            <div 
              key={i} 
              className={`${styles.cell} ${cell.colorClass}`} 
              onMouseEnter={() => setHoveredCell({ date: cell.date, time: cell.formattedTime })}
              onMouseLeave={() => setHoveredCell(null)}
            />
          ))}
        </div>
        
        {/* Interactive Hover Overlay */}
        {hoveredCell && (
          <div className={styles.hoverTooltip}>
            {hoveredCell.date}: <span className={styles.highlight}>{hoveredCell.time}</span>
          </div>
        )}
      </div>
      
      <div className="card">
        <div className={styles.titleContainer}>
          <History size={14} />
          <h4>RECENT_FORGES</h4>
        </div>
        <div className={styles.recentList}>
          {recentSessions.length === 0 ? (
            <div className={styles.noSessions}>NO_RECENT_DATA</div>
          ) : (
            recentSessions.map(session => (
              <div key={session.id} className={styles.recentItem}>
                <span className={styles.sessionDate}>{session.date}</span>
                <span className={styles.sessionDuration}>
                  {Math.floor(session.duration_seconds / 60)}m
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};

