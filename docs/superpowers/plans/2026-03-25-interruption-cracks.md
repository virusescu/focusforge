# Interruption Cracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record when the timer is paused mid-session and render thin vertical crack marks inside session blocks on the Day View timeline, showing fragmentation at a glance with zero user friction.

**Architecture:** A new `session_pauses` table holds one row per pause event (`session_id`, `pause_time TEXT`). `useTimer` tracks the actual session start time and records absolute ISO timestamps at each pause. Both are sent in the `timer-saved` event. `FocusContext` passes the real `startTime` to the DB instead of computing it at save time (fixing a pre-existing bug). `getSessionsForDay` fetches pauses in a second query and maps them onto sessions. Crack position is computed as `(pauseTime - sessionStart) / duration`, enabling future time-of-day analytics on the raw timestamps.

**Tech Stack:** TypeScript, SQLite (Tauri plugin-sql), React, SCSS Modules, Vitest + Testing Library

---

## Product Description

### What It Is

Every time you pause the timer mid-session, a timestamp is silently recorded. When the session is saved, those pause moments are stored alongside it. In the Analytics Day View, each session block gains thin vertical hairlines — **cracks** — at the exact moments the pauses occurred.

A completely clean session looks like a solid bar. A session with five interruptions shows five thin fracture lines inside it.

### How It Looks

Session blocks currently sit on the 8am–2am timeline as solid orange rectangles. After this change:

- Each crack is a **2px vertical line** spanning the full height of the session block, positioned proportionally (a pause at the 25-minute mark of a 45-minute session appears 55% from the left edge of the block).
- Crack color: a dark semi-transparent gradient so it reads as a **heat fracture** rather than a UI artifact — consistent with the forge aesthetic.
- The session block tooltip gains an interruption count: e.g., `"09:00 — 45m [3 interruptions]"`.
- If a session has no pauses, it looks exactly as it does today.

### Why It's Helpful

Most people don't realize how fragmented their sessions are until they see it. A 45-minute session with 6 cracks tells a fundamentally different story than a 45-minute session with 1. The Day View already shows *how long* you focused — cracks add *how continuously* you focused.

Pause times are stored as absolute timestamps, so future analytics can answer questions like "what time of day do I interrupt most?" without any schema changes.

---

## Key Design Decisions

**Absolute ISO timestamps in `session_pauses.pause_time`.** Each pause stores the full wall-clock time. This makes future time-of-day analytics (e.g., interruption heatmap by hour) trivial — just query and group by hour. Crack position is computed as `(pauseTime - sessionStart) / duration`.

**Fix `start_time` to be the actual session start, not the save time.** Currently `start_time` is stored as `new Date()` at reset time (the session *end*). With absolute pause times, we need accurate `start_time` for crack positioning to be correct. `useTimer` now records the start timestamp when the timer first activates and includes it in the `timer-saved` event. This also fixes the pre-existing bug where analytics blocks appear shifted right on the timeline.

**Separate `session_pauses` table.** Proper relational structure — queryable, indexable, cleaned up with a simple `DELETE WHERE session_id = ?`.

**Cracks are children inside the session block.** Contained by `overflow: hidden` + `position: relative` on the block.

**Tooltip shows count only.** `[3 interruptions]` — positions are visible on the block itself.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `pause_times?: string[]` to `FocusSession` |
| Modify | `src/db.ts` | New `session_pauses` table; update `saveFocusSession`, `getSessionsForDay`, `deleteFocusSession` |
| Modify | `src/hooks/useTimer.ts` | Track session start time and pause timestamps; include both in `timer-saved` event |
| Modify | `src/contexts/FocusContext.tsx` | Use event's `startTime` instead of `new Date()`; forward `pauseTimes` to DB |
| Modify | `src/components/AnalyticsView.tsx` | Render crack divs inside session blocks; update tooltip |
| Modify | `src/components/AnalyticsView.module.scss` | `.crack` style; add `position: relative; overflow: hidden` to `.sessionBlock` |
| Modify | `src/db.test.ts` | Update existing session tests; add pause-related DB tests |
| Modify | `src/hooks/useTimer.test.ts` | Test start time and pause timestamps are recorded and included in event |
| Modify | `src/contexts/FocusContext.test.tsx` | Update mock signature; test startTime and pauseTimes are forwarded |
| Modify | `src/components/AnalyticsView.test.tsx` | Test crack divs render when session has pause_times |

---

## Task 1: DB — `session_pauses` Table, Updated Queries

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/db.ts`
- Modify: `src/db.test.ts`

- [ ] **Step 1: Write failing DB tests**

Add these tests to `src/db.test.ts`, inside `describe('Focus Session Methods', ...)`:

```typescript
    it('saveFocusSession inserts a session_pauses row for each pause time', async () => {
      mockExecute.mockResolvedValueOnce({ lastInsertId: 7, rowsAffected: 1 });

      await saveFocusSession(
        '2024-03-24T09:00:00.000Z',
        1800,
        ['2024-03-24T09:07:30.000Z', '2024-03-24T09:22:00.000Z']
      );

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_pauses'),
        [7, '2024-03-24T09:07:30.000Z']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_pauses'),
        [7, '2024-03-24T09:22:00.000Z']
      );
    });

    it('saveFocusSession with no pause times makes only one execute call', async () => {
      mockExecute.mockResolvedValueOnce({ lastInsertId: 8, rowsAffected: 1 });

      await saveFocusSession('2024-03-24T09:00:00.000Z', 1800);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('getSessionsForDay fetches pause times and attaches them to sessions', async () => {
      mockSelect
        .mockResolvedValueOnce([
          { id: 1, start_time: '2024-03-24T09:00:00.000Z', duration_seconds: 1800, date: '2024-03-24' },
        ])
        .mockResolvedValueOnce([
          { session_id: 1, pause_time: '2024-03-24T09:07:30.000Z' },
          { session_id: 1, pause_time: '2024-03-24T09:22:00.000Z' },
        ]);

      const sessions = await getSessionsForDay('2024-03-24');

      expect(sessions[0].pause_times).toEqual([
        '2024-03-24T09:07:30.000Z',
        '2024-03-24T09:22:00.000Z',
      ]);
    });

    it('getSessionsForDay returns empty pause_times when no pauses exist', async () => {
      mockSelect
        .mockResolvedValueOnce([
          { id: 1, start_time: '2024-03-24T09:00:00.000Z', duration_seconds: 1800, date: '2024-03-24' },
        ])
        .mockResolvedValueOnce([]);

      const sessions = await getSessionsForDay('2024-03-24');

      expect(sessions[0].pause_times).toEqual([]);
    });

    it('deleteFocusSession deletes pause records before the session', async () => {
      await deleteFocusSession(42);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM session_pauses WHERE session_id = ?'),
        [42]
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM focus_sessions WHERE id = ?'),
        [42]
      );
    });
```

Also update the existing `'getSessionsForDay should call select with selected date and next day'` test to handle the second `mockSelect` call:

```typescript
    it('getSessionsForDay should call select with selected date and next day', async () => {
      const testDate = '2024-03-24';
      mockSelect
        .mockResolvedValueOnce([])  // sessions query — empty means no pauses query runs
        .mockResolvedValueOnce([]); // guard in case it does run
      await getSessionsForDay(testDate);
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('date = $1'),
        [testDate, '2024-03-25']
      );
    });
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /c/Work/focusforge && npm test -- db.test
```

Expected: FAIL — `session_pauses` table doesn't exist, `saveFocusSession` doesn't accept pause times, etc.

- [ ] **Step 3: Add `pause_times` to FocusSession type**

In `src/types/index.ts`, update `FocusSession`:

```typescript
export interface FocusSession {
  id: number;
  start_time: string;
  duration_seconds: number;
  date: string;
  pause_times?: string[];
}
```

- [ ] **Step 4: Create `session_pauses` table in `initDb`**

In `src/db.ts`, inside `initDb`, add after the `objectives` table creation:

```typescript
  await database.execute(`
    CREATE TABLE IF NOT EXISTS session_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      pause_time TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
    )
  `);
```

- [ ] **Step 5: Update `saveFocusSession`**

Replace the existing function:

```typescript
export async function saveFocusSession(startTime: string, durationSeconds: number, pauseTimes: string[] = []) {
  const database = await getDb();
  const date = startTime.split('T')[0];
  const result = await database.execute(
    'INSERT INTO focus_sessions (start_time, duration_seconds, date) VALUES (?, ?, ?)',
    [startTime, durationSeconds, date]
  );
  const sessionId = result.lastInsertId;
  for (const pauseTime of pauseTimes) {
    await database.execute(
      'INSERT INTO session_pauses (session_id, pause_time) VALUES (?, ?)',
      [sessionId, pauseTime]
    );
  }
}
```

- [ ] **Step 6: Update `getSessionsForDay`**

Replace the existing function:

```typescript
export async function getSessionsForDay(date: string): Promise<FocusSession[]> {
  const database = await getDb();

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  const rows = await database.select<FocusSession[]>(
    `SELECT * FROM focus_sessions
     WHERE (date = $1 AND strftime('%H:%M:%S', start_time) >= '08:00:00')
        OR (date = $2 AND strftime('%H:%M:%S', start_time) < '02:00:00')
     ORDER BY start_time ASC`,
    [date, nextDayStr]
  );

  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const pauses = await database.select<{ session_id: number; pause_time: string }[]>(
    `SELECT session_id, pause_time FROM session_pauses WHERE session_id IN (${placeholders}) ORDER BY pause_time ASC`,
    ids
  );

  const pauseMap = new Map<number, string[]>();
  for (const p of pauses) {
    if (!pauseMap.has(p.session_id)) pauseMap.set(p.session_id, []);
    pauseMap.get(p.session_id)!.push(p.pause_time);
  }

  return rows.map(row => ({
    ...row,
    pause_times: pauseMap.get(row.id) || [],
  }));
}
```

- [ ] **Step 7: Update `deleteFocusSession`**

Replace the existing function:

```typescript
export async function deleteFocusSession(id: number) {
  const database = await getDb();
  await database.execute('DELETE FROM session_pauses WHERE session_id = ?', [id]);
  await database.execute('DELETE FROM focus_sessions WHERE id = ?', [id]);
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
cd /c/Work/focusforge && npm test -- db.test
```

Expected: All DB tests passing.

- [ ] **Step 9: Commit**

```bash
cd /c/Work/focusforge && git add src/types/index.ts src/db.ts src/db.test.ts && git commit -m "feat: add session_pauses table with absolute timestamps"
```

---

## Task 2: Track Start Time and Pause Timestamps in useTimer

**Files:**
- Modify: `src/hooks/useTimer.ts`
- Modify: `src/hooks/useTimer.test.ts`

`useTimer` now records the actual session start time when the timer first activates. Each pause records `new Date().toISOString()`. Both are sent in `timer-saved`. This fixes the pre-existing issue where `start_time` was stored as the reset time instead of the session start.

- [ ] **Step 1: Write failing tests**

Add to `src/hooks/useTimer.test.ts`, inside the existing `describe` block:

```typescript
  it('includes startTime in timer-saved event', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const before = Date.now();
    const { result } = renderHook(() => useTimer(1));

    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    act(() => { result.current.resetTimer(); });

    const after = Date.now();
    const detail = listener.mock.calls[0][0].detail;
    const startMs = new Date(detail.startTime).getTime();

    expect(startMs).toBeGreaterThanOrEqual(before);
    expect(startMs).toBeLessThanOrEqual(after);

    window.removeEventListener('timer-saved', listener);
  });

  it('records pause timestamp when timer is paused mid-session', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const pauseTime = new Date('2024-03-24T10:15:00.000Z');
    vi.setSystemTime(pauseTime);

    const { result } = renderHook(() => useTimer(1));
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(10000); });
    act(() => { result.current.toggleTimer(); }); // pause — system time is pauseTime
    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          pauseTimes: ['2024-03-24T10:15:00.000Z'],
        }),
      })
    );

    window.removeEventListener('timer-saved', listener);
  });

  it('records multiple pause timestamps', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const { result } = renderHook(() => useTimer(1));

    vi.setSystemTime(new Date('2024-03-24T10:00:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // start
    act(() => { vi.advanceTimersByTime(20000); });

    vi.setSystemTime(new Date('2024-03-24T10:20:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // first pause

    act(() => { result.current.toggleTimer(); }); // resume

    vi.setSystemTime(new Date('2024-03-24T10:40:00.000Z'));
    act(() => { result.current.toggleTimer(); }); // second pause

    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          pauseTimes: ['2024-03-24T10:20:00.000Z', '2024-03-24T10:40:00.000Z'],
        }),
      })
    );

    window.removeEventListener('timer-saved', listener);
  });

  it('clears pause timestamps and startTime after reset', () => {
    const listener = vi.fn();
    window.addEventListener('timer-saved', listener);

    const { result } = renderHook(() => useTimer(1));

    // First session with a pause
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    act(() => { result.current.toggleTimer(); });
    act(() => { result.current.resetTimer(); });

    listener.mockClear();

    // Second session — no pauses
    act(() => { result.current.toggleTimer(); });
    act(() => { vi.advanceTimersByTime(30000); });
    act(() => { result.current.resetTimer(); });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ pauseTimes: [] }),
      })
    );

    window.removeEventListener('timer-saved', listener);
  });
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /c/Work/focusforge && npm test -- useTimer
```

Expected: FAIL — `timer-saved` event detail has no `startTime` or `pauseTimes`.

- [ ] **Step 3: Update useTimer.ts**

Replace the full content of `src/hooks/useTimer.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { soundEngine } from '../utils/audio';

const PAUSE_LIMIT = 60; // seconds

export const useTimer = (multiplier: number = 1) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);

  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;

  const startTimeRef = useRef<string | null>(null);
  const pauseTimesRef = useRef<string[]>([]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setPauseSeconds(0);
    if (secondsRef.current > 0) {
      window.dispatchEvent(new CustomEvent('timer-saved', {
        detail: {
          durationSeconds: secondsRef.current,
          startTime: startTimeRef.current ?? new Date().toISOString(),
          pauseTimes: [...pauseTimesRef.current],
        },
      }));
    }
    setSeconds(0);
    startTimeRef.current = null;
    pauseTimesRef.current = [];
    window.dispatchEvent(new CustomEvent('timer-reset'));
  }, []);

  // Focus tick
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + multiplier);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, multiplier]);

  // Pause countdown — only runs when paused mid-session
  useEffect(() => {
    if (isActive || seconds === 0) {
      setPauseSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setPauseSeconds((prev) => {
        const next = prev + multiplier;
        if (next >= PAUSE_LIMIT) {
          clearInterval(interval);
          soundEngine.playReboot();
          window.dispatchEvent(new CustomEvent('timer-reset'));
          resetTimer();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, seconds, resetTimer]);

  const toggleTimer = useCallback(() => {
    const nextState = !isActive;
    setIsActive(nextState);
    if (nextState) {
      // Starting or resuming — record start time on first activation only
      if (!startTimeRef.current) {
        startTimeRef.current = new Date().toISOString();
      }
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
      // Pausing — record wall-clock time of this pause
      pauseTimesRef.current = [...pauseTimesRef.current, new Date().toISOString()];
      window.dispatchEvent(new CustomEvent('timer-paused'));
    }
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    seconds,
    isActive,
    pauseSeconds,
    pauseLimit: PAUSE_LIMIT,
    toggleTimer,
    resetTimer,
    formatTime,
    minutes: seconds / 60,
  };
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /c/Work/focusforge && npm test -- useTimer
```

Expected: All useTimer tests passing.

- [ ] **Step 5: Commit**

```bash
cd /c/Work/focusforge && git add src/hooks/useTimer.ts src/hooks/useTimer.test.ts && git commit -m "feat: track real session start time and absolute pause timestamps in useTimer"
```

---

## Task 3: Pipe Start Time and Pause Times Through FocusContext

**Files:**
- Modify: `src/contexts/FocusContext.tsx`
- Modify: `src/contexts/FocusContext.test.tsx`

- [ ] **Step 1: Update mock and write failing tests**

In `src/contexts/FocusContext.test.tsx`, update the `saveFocusSession` mock line:

```typescript
  saveFocusSession: (start: string, dur: number, pauses: string[]) => mockSaveSession(start, dur, pauses),
```

Update the existing `'listens for timer-saved event and triggers save'` test to include the new event fields and updated expectation:

```typescript
  it('listens for timer-saved event and triggers save', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('timer-saved', {
        detail: { durationSeconds: 120, startTime: '2024-03-24T09:00:00.000Z', pauseTimes: [] },
      }));
    });

    await waitFor(() => {
      expect(mockSaveSession).toHaveBeenCalledWith(
        '2024-03-24T09:00:00.000Z',
        120,
        []
      );
    });
  });
```

Add a new test after it:

```typescript
  it('forwards startTime and pauseTimes from timer-saved event to saveFocusSession', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('timer-saved', {
        detail: {
          durationSeconds: 120,
          startTime: '2024-03-24T09:00:00.000Z',
          pauseTimes: ['2024-03-24T09:05:00.000Z', '2024-03-24T09:12:00.000Z'],
        },
      }));
    });

    await waitFor(() => {
      expect(mockSaveSession).toHaveBeenCalledWith(
        '2024-03-24T09:00:00.000Z',
        120,
        ['2024-03-24T09:05:00.000Z', '2024-03-24T09:12:00.000Z']
      );
    });
  });
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
cd /c/Work/focusforge && npm test -- FocusContext
```

Expected: FAIL — context still uses `new Date()` for startTime and ignores pauseTimes.

- [ ] **Step 3: Update FocusContext.tsx**

Replace the `saveSession` callback:

```typescript
  const saveSession = useCallback(async (startTime: string, durationSeconds: number, pauseTimes: string[] = []) => {
    if (durationSeconds < 60) return;
    await dbSaveFocusSession(startTime, durationSeconds, pauseTimes);
    await refreshData();
  }, [refreshData]);
```

Replace the `handleTimerSaved` handler inside its `useEffect`:

```typescript
    const handleTimerSaved = (e: Event) => {
      const customEvent = e as CustomEvent<{ durationSeconds: number; startTime: string; pauseTimes?: string[] }>;
      if (customEvent.detail && customEvent.detail.durationSeconds) {
        saveSession(
          customEvent.detail.startTime,
          customEvent.detail.durationSeconds,
          customEvent.detail.pauseTimes || []
        );
      }
    };
```

Also update the `FocusContextType` interface's `saveSession` signature:

```typescript
  saveSession: (startTime: string, durationSeconds: number, pauseTimes?: string[]) => Promise<void>;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /c/Work/focusforge && npm test -- FocusContext
```

Expected: All FocusContext tests passing.

- [ ] **Step 5: Commit**

```bash
cd /c/Work/focusforge && git add src/contexts/FocusContext.tsx src/contexts/FocusContext.test.tsx && git commit -m "feat: use real session startTime and forward pauseTimes through FocusContext"
```

---

## Task 4: Render Cracks in AnalyticsView

**Files:**
- Modify: `src/components/AnalyticsView.tsx`
- Modify: `src/components/AnalyticsView.module.scss`
- Modify: `src/components/AnalyticsView.test.tsx`

Crack position: `(pauseTime - sessionStart) / (durationSeconds * 1000)`. Both are in milliseconds after conversion.

- [ ] **Step 1: Write failing tests**

Add to `src/components/AnalyticsView.test.tsx`:

```typescript
  it('renders crack marks inside session blocks when pause_times exist', async () => {
    const { getSessionsForDay } = await import('../db');
    vi.mocked(getSessionsForDay)
      .mockResolvedValueOnce([
        {
          id: 1,
          start_time: '2026-03-24T09:00:00.000Z',
          duration_seconds: 3600,
          date: '2026-03-24',
          pause_times: ['2026-03-24T09:15:00.000Z', '2026-03-24T09:45:00.000Z'],
        },
      ])
      .mockResolvedValueOnce([]);

    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('interruption-crack').length).toBe(2);
    });
  });

  it('renders no cracks when session has no pause_times', async () => {
    const { getSessionsForDay } = await import('../db');
    vi.mocked(getSessionsForDay)
      .mockResolvedValueOnce([
        { id: 1, start_time: '2026-03-24T09:00:00.000Z', duration_seconds: 3600, date: '2026-03-24' },
      ])
      .mockResolvedValueOnce([]);

    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('interruption-crack')).not.toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd /c/Work/focusforge && npm test -- AnalyticsView
```

Expected: FAIL — `interruption-crack` elements not found.

- [ ] **Step 3: Update session block render in AnalyticsView.tsx**

Replace the `sessions.map(s => { ... })` block inside the track:

```tsx
                    sessions.map(s => {
                      const pos = getPosition(s.start_time, s.duration_seconds);
                      if (!pos) return null;
                      const isHighlighted = hoveredSessionId === s.id;
                      const crackCount = s.pause_times?.length ?? 0;
                      const sessionStartMs = new Date(s.start_time).getTime();
                      const sessionDurationMs = s.duration_seconds * 1000;
                      return (
                        <div
                          key={s.id}
                          className={`${styles.sessionBlock} ${isHighlighted ? styles.highlighted : ''}`}
                          style={pos}
                          onMouseEnter={() => handleMouseEnterSession(s.id)}
                          onMouseLeave={() => setHoveredSessionId(null)}
                          title={`${new Date(s.start_time).toLocaleTimeString()} - ${Math.floor(s.duration_seconds / 60)}m${crackCount > 0 ? ` [${crackCount} interruption${crackCount === 1 ? '' : 's'}]` : ''}`}
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
```

- [ ] **Step 4: Update `.sessionBlock` and add `.crack` in AnalyticsView.module.scss**

Find the existing `.sessionBlock` rule and add `position: relative` and `overflow: hidden`:

```scss
  position: relative;
  overflow: hidden;
```

Then add `.crack` after `.sessionBlock`:

```scss
.crack {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.45), transparent);
  pointer-events: none;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /c/Work/focusforge && npm test -- AnalyticsView
```

Expected: All AnalyticsView tests passing.

- [ ] **Step 6: Run the full test suite**

```bash
cd /c/Work/focusforge && npm test
```

Expected: All tests passing with no regressions.

- [ ] **Step 7: Commit**

```bash
cd /c/Work/focusforge && git add src/components/AnalyticsView.tsx src/components/AnalyticsView.module.scss src/components/AnalyticsView.test.tsx && git commit -m "feat: render interruption cracks inside session blocks in Day View"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Pause events recorded as absolute ISO timestamps — no user input required
- ✅ Proper relational storage: `session_pauses` table with `session_id` + `pause_time TEXT`
- ✅ Session `start_time` now stores the actual start (fixes pre-existing analytics bug)
- ✅ `deleteFocusSession` cleans up pause records before deleting session
- ✅ Crack position: `(pauseTime - sessionStart) / durationMs` — correct proportional placement
- ✅ Tooltip includes interruption count
- ✅ No cracks rendered when session has no pause_times
- ✅ Cracks contained within block bounds (`overflow: hidden`)
- ✅ Pause times and startTime cleared between sessions
- ✅ Full data flow: useTimer → event → FocusContext → DB → AnalyticsView
- ✅ Existing `deleteFocusSession` test updated for two delete calls
- ✅ Existing `getSessionsForDay` test updated for second `mockSelect` call
- ✅ Existing FocusContext `timer-saved` test updated for new event shape

**Placeholder scan:** No TBDs. All code shown. All test expectations explicit.

**Type consistency:** `pause_times: string[]` in `FocusSession`, `saveFocusSession(startTime, durationSeconds, pauseTimes: string[])`, event payload `{ durationSeconds, startTime, pauseTimes }`, `saveSession(startTime, durationSeconds, pauseTimes)` — consistent throughout all four tasks.
