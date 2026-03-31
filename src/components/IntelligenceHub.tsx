import { type FC, useState, useEffect, useCallback, useMemo } from 'react';
import styles from './IntelligenceHub.module.scss';
import { ArrowLeft, Activity, HelpCircle, Clock, Calendar, BarChart3, Shield } from 'lucide-react';
import { getAllSessions, getFragmentationStats } from '../db';
import { useAuth } from '../contexts/AuthContext';
import type { FocusSession } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  onBack: () => void;
}

export const IntelligenceHub: FC<Props> = ({ onBack }) => {
  const { authUser } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [fragStats, setFragStats] = useState<{ session_id: number; pause_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!authUser) return;
      try {
        const [allSessions, frag] = await Promise.all([
          getAllSessions(authUser.id),
          getFragmentationStats(authUser.id),
        ]);
        setSessions(allSessions);
        setFragStats(frag);
      } catch (e) {
        console.error('Failed to load intelligence data', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authUser]);

  const handleBack = useCallback(() => {
    soundEngine.playClick();
    onBack();
  }, [onBack]);

  const handleHover = () => {
    soundEngine.playHover();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  // ── Focus by Hour-of-Day ──
  const hourData = useMemo(() => {
    const buckets = new Array(24).fill(0);
    for (const s of sessions) {
      const start = new Date(s.start_time);
      const startHour = start.getHours();
      const startMinFrac = start.getMinutes() / 60;
      const durationHours = s.duration_seconds / 3600;

      let remaining = durationHours;
      let currentHour = startHour;
      let currentFrac = startMinFrac;

      while (remaining > 0) {
        const slotRemaining = 1 - currentFrac;
        const consumed = Math.min(remaining, slotRemaining);
        buckets[currentHour % 24] += consumed * 3600;
        remaining -= consumed;
        currentFrac = 0;
        currentHour++;
      }
    }
    return buckets;
  }, [sessions]);

  const maxHour = Math.max(...hourData, 1);

  // ── Focus by Day-of-Week ──
  const dowData = useMemo(() => {
    const buckets = new Array(7).fill(0);
    for (const s of sessions) {
      const d = new Date(s.start_time);
      buckets[d.getDay()] += s.duration_seconds;
    }
    return [buckets[1], buckets[2], buckets[3], buckets[4], buckets[5], buckets[6], buckets[0]];
  }, [sessions]);

  const maxDow = Math.max(...dowData, 1);
  const dowLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // ── Session Length Distribution ──
  const durationBuckets = useMemo(() => {
    const labels = ['<5m', '5-15m', '15-30m', '30-45m', '45-60m', '60m+'];
    const counts = new Array(6).fill(0);
    for (const s of sessions) {
      const m = s.duration_seconds / 60;
      if (m < 5) counts[0]++;
      else if (m < 15) counts[1]++;
      else if (m < 30) counts[2]++;
      else if (m < 45) counts[3]++;
      else if (m < 60) counts[4]++;
      else counts[5]++;
    }
    return { labels, counts };
  }, [sessions]);

  const maxBucket = Math.max(...durationBuckets.counts, 1);

  // ── Fragmentation Index ──
  const fragmentation = useMemo(() => {
    if (fragStats.length === 0) return { avgPauses: 0, cleanRatio: 0, total: 0 };
    const totalPauses = fragStats.reduce((acc, f) => acc + f.pause_count, 0);
    const cleanCount = fragStats.filter(f => f.pause_count === 0).length;
    return {
      avgPauses: totalPauses / fragStats.length,
      cleanRatio: (cleanCount / fragStats.length) * 100,
      total: fragStats.length,
    };
  }, [fragStats]);

  const formatMinutes = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack} onMouseEnter={handleHover}>
          <ArrowLeft size={16} />
          <span>BACK_TO_HUD</span>
        </button>
        <div className={styles.titleArea}>
          <Activity size={20} className={styles.titleIcon} />
          <h2>OPERATOR_INTELLIGENCE_HUB</h2>
        </div>
        <button
          className={`${styles.helpBtn} ${showHelp ? styles.active : ''}`}
          onClick={() => { soundEngine.playClick(); setShowHelp(!showHelp); }}
          onMouseEnter={handleHover}
          title="PANEL_INFO"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showHelp && (
        <div className={`card ${styles.helpPanel}`}>
          <div className={styles.helpGrid}>
            <div className={styles.helpItem}>
              <strong><Clock size={12} /> FOCUS_BY_HOUR:</strong>
              Total accumulated focus minutes bucketed by hour (0-23). Splits sessions spanning hour boundaries. Identifies your "Prime Time" — when your brain is naturally most online.
            </div>
            <div className={styles.helpItem}>
              <strong><Calendar size={12} /> FOCUS_BY_DAY:</strong>
              Total focus time per weekday across all history. Reveals weekly patterns — which days produce the most deep work and which are consistently low.
            </div>
            <div className={styles.helpItem}>
              <strong><BarChart3 size={12} /> SESSION_DISTRIBUTION:</strong>
              Histogram of all sessions by duration range. Shows whether you tend toward short bursts or deep forges. Watching the distribution shift right over weeks is a strong signal.
            </div>
            <div className={styles.helpItem}>
              <strong><Shield size={12} /> FRAGMENTATION_INDEX:</strong>
              Average pauses per session and "Clean Forge Ratio" — the percentage of sessions completed with zero interruptions. Higher ratio = more disciplined focus.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingState}>AGGREGATING_NEURAL_TELEMETRY...</div>
      ) : sessions.length === 0 ? (
        <div className={styles.loadingState}>INSUFFICIENT_DATA — COMPLETE_FORGE_SESSIONS_TO_POPULATE</div>
      ) : (
        <div className={styles.grid}>
          {/* Panel 1: Focus by Hour */}
          <div className="card">
            <div className={styles.panelHeader}>
              <Clock size={14} />
              <h4>FOCUS_BY_HOUR</h4>
            </div>
            <div className={styles.barChart}>
              {hourData.map((val, i) => (
                <div key={i} className={styles.barCol}>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ height: `${(val / maxHour) * 100}%` }}
                      title={`${String(i).padStart(2, '0')}:00 — ${formatMinutes(val)}`}
                    />
                  </div>
                  <span className={styles.barLabel}>{i % 3 === 0 ? String(i).padStart(2, '0') : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: Focus by Day-of-Week */}
          <div className="card">
            <div className={styles.panelHeader}>
              <Calendar size={14} />
              <h4>FOCUS_BY_DAY</h4>
            </div>
            <div className={styles.horizChart}>
              {dowData.map((val, i) => (
                <div key={i} className={styles.horizRow}>
                  <span className={styles.horizLabel}>{dowLabels[i]}</span>
                  <div className={styles.horizTrack}>
                    <div
                      className={styles.horizFill}
                      style={{ width: `${(val / maxDow) * 100}%` }}
                    />
                  </div>
                  <span className={styles.horizValue}>{formatMinutes(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3: Session Length Distribution */}
          <div className="card">
            <div className={styles.panelHeader}>
              <BarChart3 size={14} />
              <h4>SESSION_DISTRIBUTION</h4>
            </div>
            <div className={styles.barChart}>
              {durationBuckets.counts.map((count, i) => (
                <div key={i} className={`${styles.barCol} ${styles.wide}`}>
                  <div className={styles.barCount}>{count}</div>
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${styles.secondary}`}
                      style={{ height: `${(count / maxBucket) * 100}%` }}
                    />
                  </div>
                  <span className={styles.barLabel}>{durationBuckets.labels[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 4: Fragmentation Index */}
          <div className="card">
            <div className={styles.panelHeader}>
              <Shield size={14} />
              <h4>FRAGMENTATION_INDEX</h4>
            </div>
            <div className={styles.fragPanel}>
              <div className={styles.fragMetric}>
                <div className={styles.fragLabel}>CLEAN_FORGE_RATIO</div>
                <div className={styles.fragValue}>{fragmentation.cleanRatio.toFixed(1)}%</div>
                <div className={styles.fragBar}>
                  <div className={styles.fragFill} style={{ width: `${fragmentation.cleanRatio}%` }} />
                </div>
                <div className={styles.fragSub}>Sessions with zero interruptions</div>
              </div>
              <div className={styles.fragDivider} />
              <div className={styles.fragStats}>
                <div className={styles.fragStatRow}>
                  <span className={styles.fragStatLabel}>AVG_PAUSES_PER_SESSION:</span>
                  <span className={styles.fragStatValue}>{fragmentation.avgPauses.toFixed(1)}</span>
                </div>
                <div className={styles.fragStatRow}>
                  <span className={styles.fragStatLabel}>TOTAL_SESSIONS_ANALYZED:</span>
                  <span className={styles.fragStatValue}>{fragmentation.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
