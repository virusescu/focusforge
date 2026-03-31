# Intelligence Hub & Kill Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kill Rate metric to the existing Day View diagnostics and build a new "Operator Intelligence Hub" page with four long-term stat panels (Focus by Hour, Focus by Day-of-Week, Session Length Distribution, Fragmentation Index), each with a help overlay.

**Architecture:** The Kill Rate is a small addition to `AnalyticsView.tsx` — a new row in the stats table plus a new DB query. The Intelligence Hub is a new top-level view (`IntelligenceHub.tsx`) following the same full-width layout pattern as `AnalyticsView`. Navigation adds a third view state to `App.tsx` (`'hud' | 'analytics' | 'intel'`), accessible via `I` keyboard shortcut from the HUD and a new button in SidebarLeft. All data is derived from existing `focus_sessions`, `session_pauses`, and `objectives` tables — no schema changes needed.

**Tech Stack:** React + TypeScript, SCSS Modules, SQLite via `@tauri-apps/plugin-sql`, Web Audio API (SoundEngine), lucide-react icons.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/db.ts` | Add `getKillRate()`, `getAllSessions()`, `getAllSessionsWithPauses()` queries |
| Modify | `src/components/AnalyticsView.tsx` | Add Kill Rate row to diagnostics table + help text |
| Create | `src/components/IntelligenceHub.tsx` | New page: 4 stat panels + help overlay |
| Create | `src/components/IntelligenceHub.module.scss` | Styling for the Intelligence Hub |
| Modify | `src/App.tsx` | Add `'intel'` view state, wire navigation + guard |
| Modify | `src/components/MainDisplay.tsx` | Add `I` keyboard shortcut |
| Modify | `src/components/SidebarLeft.tsx` | Add Intelligence Hub button |
| Modify | `src/components/SidebarLeft.module.scss` | Style the new button |
| Modify | `src/utils/audio.ts` | Add `playTab` sound (already exists — reuse for Intel nav) |

---

### Task 1: Kill Rate DB Query

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Add `getKillRate` function to db.ts**

Append after the `getGlobalStats` function (after line 260):

```typescript
export async function getKillRate() {
  const database = await getDb();

  // Today's date in local format
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Day count
  const dayResult = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM objectives WHERE completed_at IS NOT NULL AND date(completed_at, 'localtime') = $1",
    [todayStr]
  );

  // Week count (last 7 days)
  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const weekResult = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM objectives WHERE completed_at IS NOT NULL AND date(completed_at, 'localtime') >= $1",
    [weekStr]
  );

  // All time count
  const allResult = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM objectives WHERE completed_at IS NOT NULL"
  );

  return {
    day: dayResult[0]?.count || 0,
    week: weekResult[0]?.count || 0,
    allTime: allResult[0]?.count || 0,
  };
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `npm run dev` — confirm no TypeScript errors.

---

### Task 2: Kill Rate in AnalyticsView

**Files:**
- Modify: `src/components/AnalyticsView.tsx`

- [ ] **Step 1: Import getKillRate and add state**

Add `getKillRate` to the import from `'../db'`:

```typescript
import { getSessionsForDay, deleteFocusSession, getCompletedObjectivesForDay, getKillRate } from '../db';
```

Add state inside the component, after the `showHelp` state:

```typescript
const [killRate, setKillRate] = useState<{ day: number; week: number; allTime: number }>({ day: 0, week: 0, allTime: 0 });
```

- [ ] **Step 2: Load Kill Rate data**

Inside the `loadSessions` callback, add `getKillRate()` to the `Promise.all`:

Replace the existing `Promise.all` block:

```typescript
      const [data, completed, kr] = await Promise.all([
        getSessionsForDay(dateStr, startHourSetting, endHourSetting),
        getCompletedObjectivesForDay(dateStr, startHourSetting, endHourSetting),
        getKillRate(),
      ]);
      setSessions(data);
      setCompletedObjectives(completed);
      setKillRate(kr);
```

- [ ] **Step 3: Add Kill Rate row to the stats table**

After the FORGE_VOLUME `tableRow` div (the one with `formatDuration(totalSeconds)` etc.), add:

```tsx
              <div className={styles.tableRow}>
                <div className={styles.rowLabel}>KILL_RATE</div>
                <div className={styles.cellValue}>{killRate.day}</div>
                <div className={styles.cellValue}>{killRate.week}</div>
                <div className={styles.cellValue}>{killRate.allTime}</div>
              </div>
```

- [ ] **Step 4: Add Kill Rate to the help tooltip**

Inside the `helpContent` div, after the FORGE_VOLUME help item, add:

```tsx
                  <div className={styles.helpItem}>
                    <strong>KILL_RATE:</strong> Objectives neutralized across different time-scales.
                  </div>
```

- [ ] **Step 5: Verify Kill Rate appears in the Day View**

Run the app, navigate to analytics. The stats table should now have 3 rows: PEAK_INTENSITY, FORGE_VOLUME, KILL_RATE.

---

### Task 3: Intelligence Hub DB Queries

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Add `getAllSessions` query**

Append to `db.ts`:

```typescript
export async function getAllSessions(): Promise<FocusSession[]> {
  const database = await getDb();
  return await database.select<FocusSession[]>(
    'SELECT * FROM focus_sessions ORDER BY start_time ASC'
  );
}
```

- [ ] **Step 2: Add `getFragmentationStats` query**

Append to `db.ts`:

```typescript
export async function getFragmentationStats(): Promise<{ session_id: number; pause_count: number }[]> {
  const database = await getDb();

  // Get pause counts per session, including sessions with 0 pauses
  const results = await database.select<{ session_id: number; pause_count: number }[]>(
    `SELECT fs.id as session_id, COUNT(sp.id) as pause_count
     FROM focus_sessions fs
     LEFT JOIN session_pauses sp ON sp.session_id = fs.id
     GROUP BY fs.id
     ORDER BY fs.start_time ASC`
  );

  return results;
}
```

- [ ] **Step 3: Verify compilation**

Run: `npm run dev` — confirm no errors.

---

### Task 4: Intelligence Hub Component

**Files:**
- Create: `src/components/IntelligenceHub.tsx`

- [ ] **Step 1: Create the full IntelligenceHub component**

```typescript
import { type FC, useState, useEffect, useCallback, useMemo } from 'react';
import styles from './IntelligenceHub.module.scss';
import { ArrowLeft, Activity, HelpCircle, Clock, Calendar, BarChart3, Shield } from 'lucide-react';
import { getAllSessions, getFragmentationStats } from '../db';
import type { FocusSession } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  onBack: () => void;
}

export const IntelligenceHub: FC<Props> = ({ onBack }) => {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [fragStats, setFragStats] = useState<{ session_id: number; pause_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [allSessions, frag] = await Promise.all([
          getAllSessions(),
          getFragmentationStats(),
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
  }, []);

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

      // Distribute seconds across hour buckets
      let remaining = durationHours;
      let currentHour = startHour;
      let currentFrac = startMinFrac;

      while (remaining > 0) {
        const slotRemaining = 1 - currentFrac;
        const consumed = Math.min(remaining, slotRemaining);
        buckets[currentHour % 24] += consumed * 3600; // store as seconds
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
    const buckets = new Array(7).fill(0); // 0=Sunday...6=Saturday
    for (const s of sessions) {
      const d = new Date(s.start_time);
      buckets[d.getDay()] += s.duration_seconds;
    }
    // Reorder to Mon-Sun
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
```

- [ ] **Step 2: Verify compilation**

Run: `npm run dev` — confirm no errors (component not wired yet, just compiling).

---

### Task 5: Intelligence Hub Styles

**Files:**
- Create: `src/components/IntelligenceHub.module.scss`

- [ ] **Step 1: Create the full stylesheet**

```scss
.container {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .backBtn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-muted);
    }
  }

  .titleArea {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--primary);

    h2 {
      font-size: 1.2rem;
      letter-spacing: 0.2em;
      margin: 0;
    }
  }

  .helpBtn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover, &.active {
      color: var(--primary);
      border-color: var(--primary);
      background: var(--primary-muted);
    }
  }
}

.helpPanel {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.helpGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.helpItem {
  font-size: 0.7rem;
  line-height: 1.5;
  color: var(--text-secondary);

  strong {
    color: var(--primary);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
    font-size: 0.65rem;
    letter-spacing: 0.05em;
  }
}

.loadingState {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 0.8rem;
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.panelHeader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  color: var(--text-muted);

  h4 {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    margin: 0;
    color: var(--text-muted);
  }
}

// ── Vertical Bar Chart (Hour / Distribution) ──

.barChart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 140px;
  padding-top: 0.5rem;
}

.barCol {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;

  &.wide {
    flex: 2;
    gap: 2px;
  }
}

.barCount {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-bottom: 2px;
  min-height: 14px;
}

.barTrack {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.barFill {
  width: 100%;
  background: var(--primary);
  min-height: 1px;
  border-radius: 1px 1px 0 0;
  transition: height 0.5s ease-out;
  box-shadow: 0 0 6px var(--primary-glow);

  &.secondary {
    background: var(--secondary);
    box-shadow: 0 0 6px var(--secondary-glow);
  }

  &:hover {
    filter: brightness(1.3);
  }
}

.barLabel {
  font-size: 0.55rem;
  color: var(--text-muted);
  margin-top: 4px;
  min-height: 12px;
  text-align: center;
}

// ── Horizontal Bar Chart (Day-of-Week) ──

.horizChart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.horizRow {
  display: grid;
  grid-template-columns: 32px 1fr 50px;
  align-items: center;
  gap: 0.5rem;
}

.horizLabel {
  font-size: 0.6rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-align: right;
}

.horizTrack {
  height: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.horizFill {
  height: 100%;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary-glow);
  transition: width 0.5s ease-out;
  min-width: 1px;
}

.horizValue {
  font-size: 0.65rem;
  color: var(--text-primary);
  font-weight: bold;
  text-align: right;
}

// ── Fragmentation Panel ──

.fragPanel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.fragMetric {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.fragLabel {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.fragValue {
  font-size: 1.8rem;
  font-weight: bold;
  color: #4ade80;
  line-height: 1;
}

.fragBar {
  width: 100%;
  height: 6px;
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.fragFill {
  height: 100%;
  background: #4ade80;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  transition: width 0.5s ease-out;
}

.fragSub {
  font-size: 0.6rem;
  color: var(--text-muted);
  font-style: italic;
}

.fragDivider {
  width: 100%;
  height: 1px;
  background: var(--border);
}

.fragStats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fragStatRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fragStatLabel {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

.fragStatValue {
  font-size: 0.85rem;
  font-weight: bold;
  color: var(--text-primary);
}
```

- [ ] **Step 2: Verify compilation**

Run: `npm run dev` — confirm no errors.

---

### Task 6: Wire Navigation in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to support the `'intel'` view**

Replace the entire `App.tsx` content:

```typescript
import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { IntelligenceHub } from './components/IntelligenceHub';
import { GlitchOverlay } from './components/GlitchOverlay';
import { useFocus } from './contexts/FocusContext';
import { NavigationGuard } from './components/NavigationGuard';

function App() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ target: 'analytics' | 'intel'; dateStr?: string } | null>(null);
  const { timerStatus, resetTimer } = useFocus();

  const handleViewAnalytics = (dateStr?: string) => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'analytics', dateStr });
      return;
    }

    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
    setView('analytics');
  };

  const handleViewIntel = () => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'intel' });
      return;
    }
    setView('intel');
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    resetTimer();

    if (pendingNavigation.target === 'analytics') {
      if (pendingNavigation.dateStr) {
        setAnalyticsDate(new Date(pendingNavigation.dateStr));
      } else {
        setAnalyticsDate(new Date());
      }
      setView('analytics');
    } else {
      setView('intel');
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

  return (
    <div className="hud-container">
      <GlitchOverlay />
      <Header />
      {view === 'hud' ? (
        <>
          <SidebarLeft onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} />
        </>
      ) : view === 'analytics' ? (
        <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
      ) : (
        <IntelligenceHub onBack={() => setView('hud')} />
      )}
      <Footer />

      {pendingNavigation && (
        <NavigationGuard
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
        />
      )}
    </div>
  );
}

export default App;
```

---

### Task 7: Add `I` Shortcut to MainDisplay + Intel Button to SidebarLeft

**Files:**
- Modify: `src/components/MainDisplay.tsx`
- Modify: `src/components/SidebarLeft.tsx`
- Modify: `src/components/SidebarLeft.module.scss`

- [ ] **Step 1: Update MainDisplay props and keyboard handler**

Update the component signature to accept `onViewIntel`:

```typescript
export const MainDisplay: FC<{ onViewAnalytics?: () => void; onViewIntel?: () => void }> = ({ onViewAnalytics, onViewIntel }) => {
```

In the `handleKeyDown` function, add the `I` shortcut after the `A` shortcut block:

```typescript
      } else if (e.key.toLowerCase() === 'i') {
        if (onViewIntel) {
          soundEngine.playTab();
          onViewIntel();
        }
      }
```

Add `onViewIntel` to the useEffect dependency array (the keyboard handler one).

- [ ] **Step 2: Update SidebarLeft to accept and use `onViewIntel`**

Update the Props interface:

```typescript
interface Props {
  onViewAnalytics?: () => void;
  onViewIntel?: () => void;
}
```

Update the component signature:

```typescript
export const SidebarLeft: FC<Props> = ({ onViewAnalytics, onViewIntel }) => {
```

Add a handler:

```typescript
  const handleIntelClick = useCallback(() => {
    soundEngine.playTab();
    onViewIntel?.();
  }, [onViewIntel]);
```

After the existing analytics button block (`{onViewAnalytics && (...)}`), add:

```tsx
        {onViewIntel && (
          <button
            className={styles.intelBtn}
            onClick={handleIntelClick}
            onMouseEnter={handleHover}
          >
            <Activity size={14} />
            <span>INTELLIGENCE_HUB</span>
          </button>
        )}
```

Import `Activity` from lucide-react (add it to the existing import).

- [ ] **Step 3: Style the Intel button in SidebarLeft.module.scss**

Append after the `.analyticsBtn` block:

```scss
.intelBtn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid var(--secondary);
  color: var(--secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
  box-shadow: 0 0 5px rgba(0, 242, 255, 0.1);

  &:hover {
    background: rgba(0, 242, 255, 0.1);
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}
```

- [ ] **Step 4: Verify everything works end-to-end**

Run the app. Verify:
1. Kill Rate row appears in Day View diagnostics table
2. `I` key from HUD navigates to the Intelligence Hub
3. Intel button in sidebar navigates to the hub
4. `playTab()` sound fires on navigation
5. All 4 panels render with data (if sessions exist)
6. Help panel toggles with the `?` icon
7. `Escape` returns to HUD
8. Navigation guard fires if timer is active

- [ ] **Step 5: Commit**

```bash
git add src/db.ts src/App.tsx src/components/IntelligenceHub.tsx src/components/IntelligenceHub.module.scss src/components/AnalyticsView.tsx src/components/MainDisplay.tsx src/components/SidebarLeft.tsx src/components/SidebarLeft.module.scss
git commit -m "feat: add Kill Rate to Day View + Operator Intelligence Hub page

Add KILL_RATE metric (day/week/all-time) to the existing analytics
diagnostics table. Create new Intelligence Hub page with four stat
panels: Focus by Hour, Focus by Day-of-Week, Session Length Distribution,
and Fragmentation Index. Accessible via 'I' shortcut or sidebar button.
Includes help info panel explaining each visualization."
```
