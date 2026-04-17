import { type FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './AnalyticsView.module.scss';
import { ChevronLeft, ChevronRight, ArrowLeft, BarChart2, X, HelpCircle, Edit3, Check } from 'lucide-react';
import { getSessionsForDay, deleteFocusSession, updateFocusSession, getCompletedObjectivesForDay, getKillRate, deleteObjective as dbDeleteObjective, updateObjective as dbUpdateObjective, updateObjectiveCompletedAt as dbUpdateObjectiveCompletedAt, addCategory as dbAddCategory, updateCategory as dbUpdateCategory, deleteCategory as dbDeleteCategory } from '../db';
import { useFocus } from '../contexts/FocusContext';
import { formatDateObjWithWeekday } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import type { FocusSession, StrategicObjective } from '../types';
import { soundEngine } from '../utils/audio';
import { getPreviousWorkDay, getNextWorkDay } from '../utils/gameEconomy';
import { CompletedObjectivesModal } from './CompletedObjectivesModal';
import { CategoryManagerModal } from './CategoryManagerModal';

interface Props {
  onBack: () => void;
  initialDate?: Date;
}

interface ObjectiveDot {
  key: string;
  objectives: StrategicObjective[];
  leftPercent: number;
  clamped: boolean;
  color: string;
}

export const AnalyticsView: FC<Props> = ({ onBack, initialDate }) => {
  const { globalStats, refreshData, categories } = useFocus();
  const { user } = useUser();
  const { authUser } = useAuth();
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [completedObjectives, setCompletedObjectives] = useState<StrategicObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [hoveredDotKey, setHoveredDotKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [killRate, setKillRate] = useState<{ day: number; week: number; allTime: number }>({ day: 0, week: 0, allTime: 0 });
  const [selectedDotKey, setSelectedDotKey] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const sessionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  // Zoom state (1.0 = full width, higher = zoomed in)
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const startHourSetting = user?.day_start_hour ?? 8;
  const endHourSetting = user?.day_end_hour ?? 2;

  // Fixed 24-hour cycle from 00:00 to 00:00 (next day)
  const START_HOUR = 0;
  const TOTAL_HOURS = 24;

  const animateZoom = (targetZoom: number, mouseOffsetX: number) => {
    if (isAnimating) return;
    
    const container = scrollContainerRef.current;
    if (!container) return;

    const startZoomValue = zoom;
    const startScrollLeft = container.scrollLeft;
    
    // Calculate the point in time (0-24) we are looking at under the mouse
    const virtualX = (startScrollLeft + mouseOffsetX) / startZoomValue;
    
    setIsAnimating(true);
    const duration = 1000; // 1 second
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeInOutQuad
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentZoom = startZoomValue + (targetZoom - startZoomValue) * eased;
      setZoom(currentZoom);

      // Sync scroll immediately in the same frame
      // scrollLeft = virtualX * currentZoom - mouseOffsetX
      container.scrollLeft = (virtualX * currentZoom) - mouseOffsetX;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(step);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (isAnimating) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      const isZoomingIn = e.deltaY < 0;
      const targetZoom = isZoomingIn ? 6.0 : 1.0;

      if (targetZoom !== zoom) {
        const rect = container.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        animateZoom(targetZoom, offsetX);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isAnimating) return; // Only left click
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isAnimating) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5; // Scroll speed
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  // Remove the previous useEffect hook that used zoomAnchorRef

  // Calculate active range for highlighting
  const activeRange = useMemo(() => {
    const start = startHourSetting;
    const end = endHourSetting;
    
    if (start === end) return null;
    
    // If end is after start (e.g. 8 to 17)
    if (end > start) {
      return { left: (start / 24) * 100, width: ((end - start) / 24) * 100 };
    }
    
    // If end wraps around midnight (e.g. 20 to 2)
    // We show two highlights for the full 24h view
    return [
      { left: (start / 24) * 100, width: ((24 - start) / 24) * 100 },
      { left: 0, width: (end / 24) * 100 }
    ];
  }, [startHourSetting, endHourSetting]);

  // Auto-scroll to highlighted session
  useEffect(() => {
    if (hoveredSessionId !== null) {
      const el = sessionRefs.current.get(hoveredSessionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [hoveredSessionId]);

  const handleBack = useCallback(() => {
    soundEngine.playClick();
    onBack();
  }, [onBack]);

  const loadSessions = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    try {
      // Fetch data for the full day (0-24)
      const [data, completed, kr] = await Promise.all([
        getSessionsForDay(authUser.id, dateStr, 0, 24),
        getCompletedObjectivesForDay(authUser.id, dateStr, 0, 24),
        getKillRate(authUser.id),
      ]);
      setSessions(data);
      setCompletedObjectives(completed);
      setKillRate(kr);
    } catch (e) {
      console.error('Failed to load sessions for day', e);
    } finally {
      setLoading(false);
    }
  }, [currentDate, authUser]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const changeDay = useCallback((delta: number) => {
    soundEngine.playClick();
    setLoading(true);
    setCurrentDate(prev => {
      if (delta < 0) return getPreviousWorkDay(prev);
      return getNextWorkDay(prev);
    });
  }, []);

  const jumpToToday = useCallback(() => {
    soundEngine.playClick();
    setLoading(true);
    setCurrentDate(new Date());
  }, []);

  const isToday = currentDate.toDateString() === new Date().toDateString();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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

  useEffect(() => {
    if (editingSessionId !== null && durationInputRef.current) {
      setTimeout(() => durationInputRef.current?.focus(), 0);
    }
  }, [editingSessionId]);

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
    if (!authUser) return;
    soundEngine.playPause();
    await deleteFocusSession(id);
    await loadSessions();
    await refreshData();
  };

  const toDatetimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleDotClick = (dotKey: string) => {
    soundEngine.playClick();
    setSelectedDotKey(dotKey);
  };

  const handleDeleteCompletedObjective = async (id: number) => {
    await dbDeleteObjective(id);
    await loadSessions();
    await refreshData();
  };

  const handleUpdateCompletedObjective = async (id: number, text: string, categoryId?: number | null) => {
    await dbUpdateObjective(id, text, categoryId);
    await loadSessions();
    await refreshData();
  };

  const handleUpdateCompletedObjectiveTime = async (id: number, completedAt: string) => {
    await dbUpdateObjectiveCompletedAt(id, completedAt);
    await loadSessions();
    await refreshData();
  };

  const handleEditSession = (session: FocusSession) => {
    soundEngine.playClick();
    setEditingSessionId(session.id);
    const start = new Date(session.start_time);
    setEditStartTime(toDatetimeLocal(start));
    setEditDuration(String(Math.floor(session.duration_seconds / 60)));
  };

  const handleSaveSession = async () => {
    if (!editingSessionId) return;
    const startDate = new Date(editStartTime);
    const durationMinutes = parseInt(editDuration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) return;
    const durationSeconds = durationMinutes * 60;
    await updateFocusSession(editingSessionId, startDate.toISOString(), durationSeconds);
    setEditingSessionId(null);
    await loadSessions();
    await refreshData();
    soundEngine.playClick();
  };

  const handleCancelEditSession = () => {
    soundEngine.playClick();
    setEditingSessionId(null);
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
    if (diffDays !== 0) return null;

    const startOffset = localHours - START_HOUR;
    const durationOffset = durationSeconds / 3600;
    
    return {
      left: `${(startOffset / TOTAL_HOURS) * 100}%`,
      width: `${(durationOffset / TOTAL_HOURS) * 100}%`
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

      if (diffDays !== 0) continue;

      let localHours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      const leftPercent = (localHours / 24) * 100;
      const bucketKey = `bucket-${Math.floor(localHours * 60 / 5)}`;

      if (!groups.has(bucketKey)) groups.set(bucketKey, []);
      groups.get(bucketKey)!.push({ obj, leftPercent, clamped: false });
    }

    return Array.from(groups.entries()).map(([key, items]) => {
      const firstObj = items[0].obj;
      const catColor = categories.find(c => c.id === firstObj.category_id)?.color || '#333333';
      
      return {
        key,
        objectives: items.map(i => i.obj),
        leftPercent: items[0].leftPercent,
        clamped: false,
        color: catColor,
      };
    });
  }, [completedObjectives, currentDate, categories]);

  // Derived: objectives for the selected dot
  const selectedDotObjectives = useMemo(() => {
    if (!selectedDotKey) return [];
    const dot = objectiveDots.find(d => d.key === selectedDotKey);
    return dot?.objectives || [];
  }, [selectedDotKey, objectiveDots]);

  // Auto-close modal when all objectives in the selected dot are deleted
  useEffect(() => {
    if (selectedDotKey && selectedDotObjectives.length === 0) {
      setSelectedDotKey(null);
    }
  }, [selectedDotKey, selectedDotObjectives]);

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  
  // Sub-hour markers (15 min intervals) visible when zoomed in
  const subHourMarkers = useMemo(() => {
    if (zoom < 3) return [];
    const markers = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 15; m < 60; m += 15) {
        markers.push({ h, m, pos: ((h + m / 60) / 24) * 100 });
      }
    }
    return markers;
  }, [zoom]);

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
              <span className={styles.value}>{formatDateObjWithWeekday(currentDate)}</span>
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

            {loading ? (
              <span className={styles.loadingHeader}>// SYNCING_NEURAL_RECORDS...</span>
            ) : sessions.length === 0 ? (
              <span className={styles.noSessionsHeader}>// NO_SESSIONS_RECORDED</span>
            ) : null}
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

        <div 
          className={styles.dayView} 
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          ref={scrollContainerRef}
        >
          <div className={styles.zoomContent} style={{ width: `${zoom * 100}%` }}>
            {/* Active Range Highlight */}
            {activeRange && (Array.isArray(activeRange) ? activeRange : [activeRange]).map((range, i) => (
              <div 
                key={i}
                className={styles.activeHighlight}
                style={{ left: `${range.left}%`, width: `${range.width}%` }}
              />
            ))}

            <div className={`${styles.timeRuler} ${isAnimating ? styles.animating : ''}`}>
              {hoursArray.map((h, i) => (
                <div key={`h-${i}`} className={styles.hourMarker} style={{ left: `${(h / 24) * 100}%` }}>
                  <span>{(h % 24).toString().padStart(2, '0')}:00</span>
                </div>
              ))}
              {subHourMarkers.map((m, i) => (
                <div key={`m-${i}`} className={styles.minuteMarker} style={{ left: `${m.pos}%` }} />
              ))}
            </div>

            <div className={styles.visualizerArea}>
              <div className={styles.track}>
                {sessions.map(s => {
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
                      title={`${new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${Math.floor(s.duration_seconds / 60)}m`}
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
                })}
              </div>

              <div className={styles.objectiveTrack}>
                {objectiveDots.map(dot => (
                  <div
                    key={dot.key}
                    data-testid="objective-dot"
                    className={styles.objectiveDot}
                    style={{ left: `${dot.leftPercent}%`, backgroundColor: dot.color }}
                    onMouseEnter={() => setHoveredDotKey(dot.key)}
                    onMouseLeave={() => setHoveredDotKey(null)}
                    onClick={() => handleDotClick(dot.key)}
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
                              {new Date(obj.completed_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                            <span className={styles.dotTooltipItem}>{obj.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className="card">
          <h4>FORGE_INTENSITY_LOG</h4>
          <div className={styles.sessionList}>
            {sessions.map(s => {
              const isHighlighted = hoveredSessionId === s.id;
              const isEditingThis = editingSessionId === s.id;

              return (
                <div
                  key={s.id}
                  ref={el => {
                    if (el) sessionRefs.current.set(s.id, el);
                    else sessionRefs.current.delete(s.id);
                  }}
                  className={`${styles.sessionItem} ${isHighlighted ? styles.itemHovered : ''}`}
                  onMouseEnter={() => handleMouseEnterSession(s.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  {isEditingThis ? (
                    <div className={styles.sessionEditForm}>
                      <div className={styles.editRow}>
                        <label>START:</label>
                        <input
                          type="date"
                          value={editStartTime.slice(0, 10)}
                          onChange={e => {
                            const date = e.target.value;
                            const time = editStartTime.slice(11, 16);
                            setEditStartTime(date ? `${date}T${time || '00:00'}` : '');
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveSession();
                            else if (e.key === 'Escape') handleCancelEditSession();
                          }}
                          className={styles.dateTimeInput}
                        />
                        <input
                          type="text"
                          placeholder="HH:MM"
                          value={editStartTime.slice(11, 16)}
                          onChange={e => {
                            const timeStr = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
                            const date = editStartTime.slice(0, 10);
                            if (date && timeStr.length === 5 && timeStr[2] === ':') {
                              setEditStartTime(`${date}T${timeStr}`);
                            } else if (date) {
                              setEditStartTime(`${date}T${timeStr.padEnd(5, ':')}`);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveSession();
                            else if (e.key === 'Escape') handleCancelEditSession();
                          }}
                          className={styles.dateTimeInput}
                        />
                      </div>
                      <div className={styles.editRow}>
                        <label>DURATION (min):</label>
                        <input
                          ref={durationInputRef}
                          type="text"
                          inputMode="numeric"
                          placeholder="minutes"
                          value={editDuration}
                          onChange={e => {
                            const val = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                            setEditDuration(val);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveSession();
                            else if (e.key === 'Escape') handleCancelEditSession();
                          }}
                          className={styles.dateTimeInput}
                        />
                      </div>
                      <div className={styles.editActions}>
                        <button onClick={handleSaveSession} title="SAVE">
                          <Check size={12} />
                        </button>
                        <button onClick={handleCancelEditSession} title="CANCEL">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.sessionMain}>
                        <span className={styles.time}>{new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        <span className={styles.duration}>{Math.floor(s.duration_seconds / 60)}m FORGE</span>
                        {(s.pause_times?.length ?? 0) > 0 && (
                          <span className={styles.interruptCount}>{s.pause_times!.length} INT</span>
                        )}
                      </div>
                      <button
                        className={styles.editSessionBtn}
                        onMouseEnter={handleHover}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSession(s);
                        }}
                        title="EDIT_SESSION"
                      >
                        <Edit3 size={14} />
                      </button>
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
                    </>
                  )}
                </div>
              );
            })}
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
                  <div className={styles.helpItem}>
                    <strong>KILL_RATE:</strong> Objectives neutralized across different time-scales.
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

              <div className={styles.tableRow}>
                <div className={styles.rowLabel}>KILL_RATE</div>
                <div className={styles.cellValue}>{killRate.day}</div>
                <div className={styles.cellValue}>{killRate.week}</div>
                <div className={styles.cellValue}>{killRate.allTime}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedDotKey && selectedDotObjectives.length > 0 && (
        <CompletedObjectivesModal
          objectives={selectedDotObjectives}
          categories={categories}
          onDelete={handleDeleteCompletedObjective}
          onUpdate={handleUpdateCompletedObjective}
          onUpdateTime={handleUpdateCompletedObjectiveTime}
          onClose={() => setSelectedDotKey(null)}
          onManageCategories={() => setShowCategoryManager(true)}
        />
      )}

      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          onAdd={async (label: string, color: string) => {
            if (!authUser) return;
            await dbAddCategory(authUser.id, label, color);
            await refreshData();
          }}
          onUpdate={async (id: number, label: string, color: string) => {
            await dbUpdateCategory(id, label, color);
            await refreshData();
          }}
          onDelete={async (id: number) => {
            await dbDeleteCategory(id);
            await refreshData();
          }}
          onClose={() => setShowCategoryManager(false)}
          objectiveCountByCategory={new Map()}
        />
      )}
    </div>
  );
};
