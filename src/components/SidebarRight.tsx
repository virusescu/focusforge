import { type FC, useEffect, useRef, useState, useCallback } from 'react';
import styles from './SidebarRight.module.scss';
import { Terminal, Activity, History, BarChart2, Gem } from 'lucide-react';
import { useSystemLog } from '../hooks/useSystemLog';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';

type RGB = [number, number, number];

const COLOR_STOPS: { at: number; color: RGB; glowRadius: number; glowOpacity: number }[] = [
  { at: 0,   color: [13, 13, 13],     glowRadius: 0, glowOpacity: 0   },
  { at: 60,  color: [94, 58, 36],     glowRadius: 0, glowOpacity: 0   },
  { at: 120, color: [238, 104, 43],   glowRadius: 4, glowOpacity: 0.4 },
  { at: 240, color: [255, 158, 109],  glowRadius: 8, glowOpacity: 0.6 },
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpRgb(c1: RGB, c2: RGB, t: number): RGB {
  return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
}

function getCellStyle(minutes: number): React.CSSProperties {
  if (minutes <= 0) return { backgroundColor: '#0d0d0d', border: '1px solid rgba(255,255,255,0.05)' };

  const capped = Math.min(minutes, COLOR_STOPS[COLOR_STOPS.length - 1].at);

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const s0 = COLOR_STOPS[i];
    const s1 = COLOR_STOPS[i + 1];
    if (capped >= s0.at && capped <= s1.at) {
      const t = (capped - s0.at) / (s1.at - s0.at);
      const [r, g, b] = lerpRgb(s0.color, s1.color, t);
      const glowRadius = lerp(s0.glowRadius, s1.glowRadius, t);
      const glowOpacity = lerp(s0.glowOpacity, s1.glowOpacity, t);
      return {
        backgroundColor: `rgb(${r},${g},${b})`,
        boxShadow: glowRadius > 0.5 ? `0 0 ${glowRadius.toFixed(1)}px rgba(${r},${g},${b},${glowOpacity.toFixed(2)})` : undefined,
      };
    }
  }

  // Beyond max stop
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  const [r, g, b] = last.color;
  return {
    backgroundColor: `rgb(${r},${g},${b})`,
    boxShadow: `0 0 ${last.glowRadius}px rgba(${r},${g},${b},${last.glowOpacity})`,
  };
}

interface Props {
  onViewAnalytics: (date?: string) => void;
  onViewIntel: () => void;
  onViewVault: () => void;
}

export const SidebarRight: FC<Props> = ({ onViewAnalytics, onViewIntel, onViewVault }) => {
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
    
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

    return {
      date: dateStr,
      minutes,
      cellStyle: getCellStyle(minutes),
      formattedTime: timeStr
    };
  });

  const handleCellMouseEnter = (date: string, time: string) => {
    soundEngine.playHover();
    setHoveredCell({ date, time });
  };

  const handleCellClick = (date: string) => {
    soundEngine.playClick();
    onViewAnalytics(date);
  };

  const handleAnalyticsClick = useCallback(() => {
    soundEngine.playClick();
    onViewAnalytics();
  }, [onViewAnalytics]);

  const handleIntelClick = useCallback(() => {
    soundEngine.playTab();
    onViewIntel();
  }, [onViewIntel]);

  const handleVaultClick = useCallback(() => {
    soundEngine.playClick();
    onViewVault();
  }, [onViewVault]);

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
              className={styles.cell}
              style={cell.cellStyle}
              onMouseEnter={() => handleCellMouseEnter(cell.date, cell.formattedTime)}
              onMouseLeave={() => setHoveredCell(null)}
              onClick={() => handleCellClick(cell.date)}
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

      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={handleAnalyticsClick}
          onMouseEnter={() => { soundEngine.playHover(); setStatusHint('SYSTEM_ANALYTICS'); }}
          onMouseLeave={clearStatusHint}
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
        >
          <BarChart2 size={24} />
        </button>
        <button
          className={styles.navBtn}
          onClick={handleIntelClick}
          onMouseEnter={() => { soundEngine.playHover(); setStatusHint('INTELLIGENCE_HUB'); }}
          onMouseLeave={clearStatusHint}
          style={{ borderColor: '#00f2ff', color: '#00f2ff' }}
        >
          <Activity size={24} />
        </button>
        <button
          className={styles.navBtn}
          onClick={handleVaultClick}
          onMouseEnter={() => { soundEngine.playHover(); setStatusHint('FORGE_VAULT'); }}
          onMouseLeave={clearStatusHint}
          style={{ borderColor: '#f0c040', color: '#f0c040' }}
        >
          <Gem size={24} />
        </button>
      </div>
    </aside>
  );
};
