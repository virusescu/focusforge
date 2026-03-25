import { type FC, useState, useEffect, useCallback, useMemo } from 'react';
import styles from './AnalyticsView.module.scss';
import { ChevronLeft, ChevronRight, ArrowLeft, BarChart2, X, HelpCircle } from 'lucide-react';
import { getSessionsForDay, deleteFocusSession, getCompletedObjectivesForDay } from '../db';
import { useFocus } from '../contexts/FocusContext';
import { useUser } from '../contexts/UserContext';
import type { FocusSession, StrategicObjective } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  onBack: () => void;
  initialDate?: Date;
}

interface ObjectiveDot {
  key: string;
  objectives: StrategicObjective[];
  leftPercent: number;
  clamped: boolean;
}

export const AnalyticsView: FC<Props> = ({ onBack, initialDate }) => {
  const { globalStats, refreshData } = useFocus();
  const { user } = useUser();
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<StrategicObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [hoveredDotKey, setHoveredDotKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const startHourSetting = user?.day_start_hour ?? 8;
  const endHourSetting = user?.day_end_hour ?? 2;

  // Configuration for dynamic time scale
  const START_HOUR = startHourSetting;
  const END_HOUR = endHourSetting <= startHourSetting ? endHourSetting + 24 : endHourSetting;
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  const handleBack = useCallback(() => {
    soundEngine.playClick();
    onBack();
  }, [onBack]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    // Use local date string YYYY-MM-DD instead of UTC-based toISOString
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    try {
      const [data, completed] = await Promise.all([
        getSessionsForDay(dateStr, startHourSetting, endHourSetting),
        getCompletedObjectivesForDay(dateStr, startHourSetting, endHourSetting),
      ]);
      setSessions(data);
      setCompletedObjectives(completed);
    } catch (e) {
      console.error('Failed to load sessions for day', e);
    } finally {
      setLoading(false);
    }
  }, [currentDate, startHourSetting, endHourSetting]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const changeDay = useCallback((delta: number) => {
    soundEngine.playClick();
    setLoading(true); // Set loading immediately to avoid flash of old data
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }, []);

  const jumpToToday = useCallback(() => {
    soundEngine.playClick();
    setLoading(true); // Set loading immediately
    setCurrentDate(new Date());
  }, []);

  const isToday = currentDate.toDateString() === new Date().toDateString();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        changeDay(-1);
      } else if (e.key === 'ArrowRight') {
        changeDay(1);
      } else if (e.key === 'Escape') {
        handleBack();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        if (!isToday) {
          e.preventDefault();
          jumpToToday();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDay, handleBack, jumpToToday, isToday]);

  const handleMouseEnterSession = (id: number) => {
    if (hoveredSessionId !== id) {
      soundEngine.playHover();
      setHoveredSessionId(id);
    }
  };

  const handleHover = () => {
    soundEngine.playHover();
  };

  const totalSeconds = sessions.reduce((acc, s) => acc + s.duration_seconds, 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const handleDelete = async (id: number) => {
    soundEngine.playPause();
    await deleteFocusSession(id);
    await loadSessions();
    await refreshData();
  };

  const diagnostics = useMemo(() => {
    if (sessions.length === 0) return null;

    const dayPeak = Math.max(...sessions.map(s => s.duration_seconds));

    let totalRecovery = 0;
    let breakCount = 0;
    for (let i = 0; i < sessions.length - 1; i++) {
      const endCurrent = new Date(sessions[i].start_time).getTime() + sessions[i].duration_seconds * 1000;
      const startNext = new Date(sessions[i + 1].start_time).getTime();
      const breakTime = (startNext - endCurrent) / 1000;
      if (breakTime > 0) {
        totalRecovery += breakTime;
        breakCount++;
      }
    }
    const avgRecovery = breakCount > 0 ? totalRecovery / breakCount : 0;
    const avgSession = totalSeconds / sessions.length;
    const coherence = Math.min((avgSession / 1800) * 100, 100);

    return { dayPeak, avgRecovery, coherence };
  }, [sessions, totalSeconds]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const getPosition = (isoString: string, durationSeconds: number) => {
    const sessionDate = new Date(isoString);
    const viewDate = new Date(currentDate);
    const sessionLocalDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    const viewLocalDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
    const diffDays = Math.round((sessionLocalDate.getTime() - viewLocalDate.getTime()) / (1000 * 60 * 60 * 24));

    let localHours = sessionDate.getHours() + sessionDate.getMinutes() / 60 + sessionDate.getSeconds() / 3600;
    if (diffDays === 1) localHours += 24;
    else if (diffDays === -1) localHours -= 24;
    else if (diffDays !== 0) return null;

    const startOffset = localHours - START_HOUR;
    const durationOffset = durationSeconds / 3600;
    
    const visibleStart = Math.max(startOffset, 0);
    const visibleEnd = Math.min(startOffset + durationOffset, TOTAL_HOURS);
    
    if (visibleStart >= TOTAL_HOURS || visibleEnd <= 0) return null;

    return {
      left: `${(visibleStart / TOTAL_HOURS) * 100}%`,
      width: `${((visibleEnd - visibleStart) / TOTAL_HOURS) * 100}%`
    };
  };

  const objectiveDots = useMemo((): ObjectiveDot[] => {
    const groups = new Map<string, { obj: StrategicObjective; leftPercent: number; clamped: boolean }[]>();

    for (const obj of completedObjectives) {
      if (!obj.completed_at) continue;

      const d = new Date(obj.completed_at);
      const viewLocalDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const objLocalDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.round((objLocalDate.getTime() - viewLocalDate.getTime()) / (1000 * 60 * 60 * 24));

      let localHours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      if (diffDays === 1) localHours += 24;
      else if (diffDays === -1) localHours -= 24;

      const clamped = localHours < START_HOUR || localHours >= END_HOUR;
      const clampedLeft = localHours < START_HOUR;
      const leftPercent = clamped
        ? clampedLeft ? 0 : 100
        : ((localHours - START_HOUR) / TOTAL_HOURS) * 100;

      const bucketKey = clamped
        ? clampedLeft ? 'clamped-left' : 'clamped-right'
        : `bucket-${Math.floor((localHours - START_HOUR) * 60 / 5)}`;

      if (!groups.has(bucketKey)) groups.set(bucketKey, []);
      groups.get(bucketKey)!.push({ obj, leftPercent, clamped });
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      objectives: items.map(i => i.obj),
      leftPercent: items[0].leftPercent,
      clamped: items[0].clamped,
    }));
  }, [completedObjectives, currentDate, START_HOUR, END_HOUR, TOTAL_HOURS]);

  const hoursArray = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className={styles.analyticsContainer}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={handleBack}
          onMouseEnter={handleHover}
        >
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
            <button onClick={() => changeDay(-1)} className={styles.navBtn} onMouseEnter={handleHover}>
              <ChevronLeft size={20} />
            </button>
            <div className={styles.currentDate}>
              <span className={styles.label}>DAY:</span>
              <span className={styles.value}>{currentDate.toLocaleDateString()}</span>
            </div>
            <button onClick={() => changeDay(1)} className={styles.navBtn} onMouseEnter={handleHover}>
              <ChevronRight size={20} />
            </button>

            {!isToday && (
              <button
                onClick={jumpToToday}
                className={styles.todayBtn}
                onMouseEnter={handleHover}
                title="JUMP_TO_PRESENT"
              >
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
            {loading ? (
              <div className={styles.loading}>SYNCING_NEURAL_RECORDS...</div>
            ) : (
              <>
                <div className={styles.track}>
                  {sessions.length === 0 ? (
                    <div className={styles.noData}>NO_SESSIONS_RECORDED_FOR_THIS_PERIOD</div>
                  ) : (
                    sessions.map(s => {
                      const pos = getPosition(s.start_time, s.duration_seconds);
                      if (!pos) return null;
                      const isHighlighted = hoveredSessionId === s.id;
                      const sessionStartMs = new Date(s.start_time).getTime();
                      const sessionDurationMs = s.duration_seconds * 1000;
                      return (
                        <div
                          key={s.id}
                          className={`${styles.sessionBlock} ${isHighlighted ? styles.highlighted : ''}`}
                          style={pos}
                          onMouseEnter={() => handleMouseEnterSession(s.id)}
                          onMouseLeave={() => setHoveredSessionId(null)}
                          title={`${new Date(s.start_time).toLocaleTimeString()} - ${Math.floor(s.duration_seconds / 60)}m`}
                        >
                          {s.pause_times?.map((pauseTime, i) => {
                            const fraction = (new Date(pauseTime).getTime() - sessionStartMs) / sessionDurationMs;
                            if (fraction <= 0 || fraction >= 1) return null;
                            return (
                              <div
                                key={i}
                                data-testid="interruption-crack"
                                className={styles.crack}
                                style={{ left: `${fraction * 100}%` }}
                              />
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={styles.objectiveTrack}>
                  {objectiveDots.map(dot => (
                    <div
                      key={dot.key}
                      data-testid="objective-dot"
                      className={`${styles.objectiveDot} ${dot.clamped ? styles.clamped : ''}`}
                      style={{ left: `${dot.leftPercent}%` }}
                      onMouseEnter={() => setHoveredDotKey(dot.key)}
                      onMouseLeave={() => setHoveredDotKey(null)}
                    >
                      {hoveredDotKey === dot.key && (
                        <div className={`${styles.dotTooltip} ${
                          dot.leftPercent < 15 ? styles.alignLeft : 
                          dot.leftPercent > 85 ? styles.alignRight : 
                          styles.alignCenter
                        }`}>
                          {dot.objectives.map(obj => (
                            <div key={obj.id} className={styles.dotTooltipRow}>
                              <span className={styles.dotTooltipTime}>
                                [{new Date(obj.completed_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                              </span>
                              <span className={styles.dotTooltipItem}>{obj.text}</span>
                            </div>
                          ))}                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
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
                onMouseEnter={() => handleMouseEnterSession(s.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
              >
                <div className={styles.sessionMain}>
                  <span className={styles.time}>{new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className={styles.duration}>{Math.floor(s.duration_seconds / 60)}m FORGE</span>
                  {(s.pause_times?.length ?? 0) > 0 && (
                    <span className={styles.interruptCount}>{s.pause_times!.length} INT</span>
                  )}
                </div>
                <button
                  className={styles.deleteBtn}
                  onMouseEnter={handleHover}
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
          <div className={styles.cardHeader}>
            <h4>OPERATOR_DIAGNOSTICS</h4>
            <button
              className={`${styles.helpToggle} ${showHelp ? styles.active : ''}`}
              onMouseEnter={handleHover}
              onClick={() => {
                soundEngine.playClick();
                setShowHelp(!showHelp);
              }}
              title="DIAGNOSTIC_INFO"
            >
              <HelpCircle size={14} />
            </button>
          </div>

          <div className={styles.stabilityInfo}>
            {showHelp && (
              <div className={styles.helpTooltip}>
                <div className={styles.helpContent}>
                  <div className={styles.helpItem}>
                    <strong>NEURAL_COHERENCE:</strong> Consistency rating. Optimal performance at 30m+ sessions.
                  </div>
                  <div className={styles.helpItem}>
                    <strong>AVG_RECOVERY:</strong> Mean idle time between consecutive forges.
                  </div>
                  <div className={styles.helpItem}>
                    <strong>PEAK_INTENSITY:</strong> Longest duration reached in a single session.
                  </div>
                  <div className={styles.helpItem}>
                    <strong>FORGE_VOLUME:</strong> Cumulative focus duration across different time-scales.
                  </div>
                </div>
              </div>
            )}

            <div className={styles.coherenceRow}>
              <div className={styles.diagItem}>
                <div className={styles.statLabel}>NEURAL_COHERENCE:</div>
                <div className={styles.statValue}>{diagnostics ? diagnostics.coherence.toFixed(1) : 0}%</div>
                <div className={styles.stabilityBar}>
                  <div className={styles.fill} style={{ width: `${diagnostics?.coherence || 0}%` }} />
                </div>
              </div>
              <div className={styles.recoveryItem}>
                <div className={styles.statLabel}>AVG_RECOVERY:</div>
                <div className={styles.statValue}>{diagnostics ? formatDuration(diagnostics.avgRecovery) : '0m'}</div>
              </div>
            </div>

            <div className={styles.statsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.colLabel}>METRIC</div>
                <div className={styles.colLabel}>DAY</div>
                <div className={styles.colLabel}>WEEK</div>
                <div className={styles.colLabel}>ALL_TIME</div>
              </div>

              <div className={styles.tableRow}>
                <div className={styles.rowLabel}>PEAK_INTENSITY</div>
                <div className={styles.cellValue}>{diagnostics ? formatDuration(diagnostics.dayPeak) : '0m'}</div>
                <div className={styles.cellValue}>-</div>
                <div className={styles.cellValue}>{globalStats ? formatDuration(globalStats.allTimePeak) : '0m'}</div>
              </div>

              <div className={styles.tableRow}>
                <div className={styles.rowLabel}>FORGE_VOLUME</div>
                <div className={styles.cellValue}>{formatDuration(totalSeconds)}</div>
                <div className={styles.cellValue}>{globalStats ? formatDuration(globalStats.weekTotal) : '0h'}</div>
                <div className={styles.cellValue}>{globalStats ? formatDuration(globalStats.allTimeTotal) : '0h'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
