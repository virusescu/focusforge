import { type FC, useState, useEffect, useCallback } from 'react';
import styles from './AnalyticsView.module.scss';
import { ChevronLeft, ChevronRight, ArrowLeft, BarChart2, X, Target } from 'lucide-react';
import { getSessionsForDay, deleteFocusSession } from '../db';
import type { FocusSession } from '../types';

interface Props {
  onBack: () => void;
  initialDate?: Date;
}

export const AnalyticsView: FC<Props> = ({ onBack, initialDate }) => {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const dateStr = currentDate.toISOString().split('T')[0];
    try {
      const data = await getSessionsForDay(dateStr);
      setSessions(data);
    } catch (e) {
      console.error('Failed to load sessions for day', e);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const changeDay = (delta: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + delta);
    setCurrentDate(next);
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  const totalSeconds = sessions.reduce((acc, s) => acc + s.duration_seconds, 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const handleDelete = async (id: number) => {
    await deleteFocusSession(id);
    await loadSessions();
  };

  // Time scale configuration: 8 AM to 2 AM (Next Day) - 18 hours
  const START_HOUR = 8;
  const END_HOUR = 26; // 24 + 2
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  const getPosition = (isoString: string, durationSeconds: number) => {
    const sessionDate = new Date(isoString);
    const viewDate = new Date(currentDate);
    
    // Normalize to local midnight for comparison
    const sessionLocalDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const viewLocalDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
    
    // Calculate difference in days (local)
    const diffDays = Math.round((sessionLocalDate.getTime() - viewLocalDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let localHours = sessionDate.getHours() + sessionDate.getMinutes() / 60 + sessionDate.getSeconds() / 3600;
    
    if (diffDays === 1) {
      localHours += 24;
    } else if (diffDays === -1) {
      localHours -= 24;
    } else if (diffDays !== 0) {
      return null;
    }
    
    const startOffset = Math.max(localHours - START_HOUR, 0);
    const endOffset = Math.min(localHours + durationSeconds / 3600 - START_HOUR, TOTAL_HOURS);
    
    if (startOffset >= TOTAL_HOURS || endOffset <= 0) return null;

    return {
      left: `${(startOffset / TOTAL_HOURS) * 100}%`,
      width: `${((endOffset - startOffset) / TOTAL_HOURS) * 100}%`
    };
  };

  // Create a linear array of hours for positioning, then modulo for display
  const hoursArray = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className={styles.analyticsContainer}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>BACK_TO_HUD</span>
        </button>
        <div className={styles.titleArea}>
          <BarChart2 size={20} className={styles.titleIcon} />
          <h2>SYSTEM_ANALYTICS</h2>
        </div>
      </div>

      <div className="card">
        <div className={styles.navBar}>
          <div className={styles.dayPicker}>
            <button onClick={() => changeDay(-1)} className={styles.navBtn}>
              <ChevronLeft size={20} />
            </button>
            <div className={styles.currentDate}>
              <span className={styles.label}>DAY:</span>
              <span className={styles.value}>{currentDate.toLocaleDateString()}</span>
            </div>
            <button onClick={() => changeDay(1)} className={styles.navBtn}>
              <ChevronRight size={20} />
            </button>

            {!isToday && (
              <button onClick={jumpToToday} className={styles.todayBtn} title="JUMP_TO_PRESENT">
                <span>TODAY</span>
              </button>
            )}
          </div>

          <div className={styles.summary}>
            <div className={styles.sumItem}>
              <span className={styles.label}>TOTAL_TIME:</span>
              <span className={styles.value}>{totalHours}h {totalMinutes}m</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.sumItem}>
              <span className={styles.label}>SESSIONS:</span>
              <span className={styles.value}>{sessions.length}</span>
            </div>
          </div>
        </div>

        <div className={styles.dayView}>
          <div className={styles.timeRuler}>
            {hoursArray.map((h, i) => (
              <div key={i} className={styles.hourMarker} style={{ left: `${((h - START_HOUR) / TOTAL_HOURS) * 100}%` }}>
                <span>{(h % 24).toString().padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          
          <div className={styles.visualizerArea}>
            <div className={styles.track}>
              {loading ? (
                <div className={styles.loading}>SYNCING_NEURAL_RECORDS...</div>
              ) : sessions.length === 0 ? (
                <div className={styles.noData}>NO_SESSIONS_RECORDED_FOR_THIS_PERIOD</div>
              ) : (
                sessions.map(s => {
                  const pos = getPosition(s.start_time, s.duration_seconds);
                  if (!pos) return null;
                  const isHighlighted = hoveredSessionId === s.id;
                  return (
                    <div 
                      key={s.id} 
                      className={`${styles.sessionBlock} ${isHighlighted ? styles.highlighted : ''}`} 
                      style={pos}
                      onMouseEnter={() => setHoveredSessionId(s.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                      title={`${new Date(s.start_time).toLocaleTimeString()} - ${Math.floor(s.duration_seconds / 60)}m`}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className="card">
          <h4>FORGE_INTENSITY_LOG</h4>
          <div className={styles.sessionList}>
            {sessions.map(s => (
              <div 
                key={s.id} 
                className={`${styles.sessionItem} ${hoveredSessionId === s.id ? styles.itemHovered : ''}`}
                onMouseEnter={() => setHoveredSessionId(s.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
              >
                <div className={styles.sessionMain}>
                  <span className={styles.time}>{new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={styles.duration}>{Math.floor(s.duration_seconds / 60)}m FORGE</span>
                </div>
                <button 
                  className={styles.deleteBtn} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                  title="DELETE_RECORD"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && <p className={styles.muted}>WAITING_FOR_DATA...</p>}
          </div>
        </div>
        
        <div className="card">
          <h4>OPERATOR_STABILITY</h4>
          <div className={styles.stabilityInfo}>
            <p>NEURAL_STABILITY: 98.4%</p>
            <p>FOCUS_COHERENCE: OPTIMAL</p>
            <div className={styles.stabilityBar}>
              <div className={styles.fill} style={{ width: '98%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
