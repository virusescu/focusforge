import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FocusProvider, useFocus } from './FocusContext';
import type { ReactNode } from 'react';

// Mock audio
vi.mock('../utils/audio', () => ({
  soundEngine: {
    playClick: vi.fn(),
    playHover: vi.fn(),
    playPowerOn: vi.fn(),
    playPowerOff: vi.fn(),
    playTick: vi.fn(),
    playAlarm: vi.fn(),
    playGlitch: vi.fn(),
    playObjectiveAdded: vi.fn(),
    playStart: vi.fn(),
    playPause: vi.fn(),
    playReboot: vi.fn(),
    playDenied: vi.fn(),
  },
  playNeutralizeChime: vi.fn(),
  playObjectiveComplete: vi.fn(),
}));

// Mock DB
const mockSaveSession = vi.fn();
const mockAddObjective = vi.fn();
const mockDeleteObjective = vi.fn();
const mockCompleteObjective = vi.fn();
const mockGetObjectives = vi.fn().mockResolvedValue([]);
const mockGetBuckets = vi.fn();
const mockUpdateBucketGeometry = vi.fn();
const mockBringBucketToFront = vi.fn();
const mockDeleteBucket = vi.fn();
const mockMoveObjectiveToBucket = vi.fn();
const mockSetObjectiveMission = vi.fn();
const mockDuplicateObjective = vi.fn();
const mockUpdateObjectiveDeadline = vi.fn();
const mockReorderCategories = vi.fn();
const mockGetCategories = vi.fn();
const mockGetTemplates = vi.fn();
const mockAddTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockReorderTemplates = vi.fn();

const UNSORTED = { id: 2, name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420, sort_order: 1, kind: 'unsorted' as const };
const WORK = { id: 9, name: 'Work', color: '#3388ff', x: 700, y: 0, w: 300, h: 420, sort_order: 2, kind: 'custom' as const };

vi.mock('../db', () => ({
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getDailyFocusStats: vi.fn().mockResolvedValue([]),
  getGlobalStats: vi.fn().mockResolvedValue({
    allTimeTotal: 0,
    allTimePeak: 0,
    weekTotal: 0,
    monthTotal: 0
  }),
  saveFocusSession: (userId: number, start: string, dur: number, pauses: string[]) => mockSaveSession(userId, start, dur, pauses),
  getObjectives: () => mockGetObjectives(),
  addObjective: (...args: unknown[]) => mockAddObjective(...args),
  deleteObjective: (id: number) => mockDeleteObjective(id),
  updateObjective: vi.fn().mockResolvedValue(undefined),
  completeObjective: (id: number) => mockCompleteObjective(id),
  reorderObjectives: vi.fn().mockResolvedValue(undefined),
  duplicateObjective: (id: number) => mockDuplicateObjective(id),
  reorderCategories: (ids: number[]) => mockReorderCategories(ids),
  getCategories: () => mockGetCategories(),
  getTemplates: () => mockGetTemplates(),
  addTemplate: (...args: unknown[]) => mockAddTemplate(...args),
  updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
  deleteTemplate: (id: number) => mockDeleteTemplate(id),
  reorderTemplates: (ids: number[]) => mockReorderTemplates(ids),
  addCategory: vi.fn().mockResolvedValue(0),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  updateObjectiveCategory: vi.fn().mockResolvedValue(undefined),
  updateObjectiveInteractionTime: vi.fn().mockResolvedValue(undefined),
  getBuckets: () => mockGetBuckets(),
  addBucket: vi.fn().mockResolvedValue(10),
  updateBucket: vi.fn().mockResolvedValue(undefined),
  updateBucketGeometry: (id: number, g: unknown) => mockUpdateBucketGeometry(id, g),
  bringBucketToFront: (id: number) => mockBringBucketToFront(id),
  deleteBucket: (id: number) => mockDeleteBucket(id),
  moveObjectiveToBucket: (id: number, bucketId: number) => mockMoveObjectiveToBucket(id, bucketId),
  reorderBucketObjectives: vi.fn().mockResolvedValue(undefined),
  setObjectiveMission: (id: number, m: number) => mockSetObjectiveMission(id, m),
  updateObjectiveDetails: vi.fn().mockResolvedValue(undefined),
  updateObjectiveDeadline: (id: number, d: string | null) => mockUpdateObjectiveDeadline(id, d),
}));

// Mock UserContext
vi.mock('./UserContext', () => ({
  useUser: () => ({
    user: { debug_speed: 1 },
    avatar: '',
    loading: false,
    updateSettings: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const STABLE_AUTH_USER = { id: 1, name: 'TEST_OP' };

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    authUser: STABLE_AUTH_USER,
    loading: false,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <FocusProvider>{children}</FocusProvider>
);

describe('FocusContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetObjectives.mockResolvedValue([]);
    mockCompleteObjective.mockResolvedValue(undefined);
    mockGetBuckets.mockResolvedValue([UNSORTED, WORK]);
    mockUpdateBucketGeometry.mockResolvedValue(undefined);
    mockBringBucketToFront.mockResolvedValue(undefined);
    mockDeleteBucket.mockResolvedValue(undefined);
    mockMoveObjectiveToBucket.mockResolvedValue(undefined);
    mockSetObjectiveMission.mockResolvedValue(undefined);
    mockDuplicateObjective.mockResolvedValue(5);
    mockUpdateObjectiveDeadline.mockResolvedValue(undefined);
    mockReorderCategories.mockResolvedValue(undefined);
    mockGetCategories.mockResolvedValue([]);
    mockGetTemplates.mockResolvedValue([]);
    mockAddTemplate.mockResolvedValue(1);
    mockUpdateTemplate.mockResolvedValue(undefined);
    mockDeleteTemplate.mockResolvedValue(undefined);
    mockReorderTemplates.mockResolvedValue(undefined);
  });

  const tpl = (id: number, name: string, sort_order: number) => ({ id, name, title: `$${name}`, details: '', color: '#fff', category_id: null, sort_order });

  it("loads the user's templates", async () => {
    mockGetTemplates.mockResolvedValue([tpl(1, 'Bug', 0), tpl(2, 'Task', 1)]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.templates.map(t => t.name)).toEqual(['Bug', 'Task']));
  });

  it('a failing templates query does not stop objectives, categories and buckets from loading', async () => {
    mockGetTemplates.mockRejectedValue(new Error('no such table: templates'));
    mockGetObjectives.mockResolvedValue([{ id: 1, text: 'Still here', created_at: '2023-01-01' }]);
    mockGetCategories.mockResolvedValue([{ id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.objectivePool).toHaveLength(1);
    expect(result.current.categories).toHaveLength(1);
    expect(result.current.buckets).toHaveLength(2);
    expect(result.current.templates).toEqual([]);
  });

  it('addTemplate saves it and shows it in the list', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockGetTemplates.mockResolvedValue([tpl(5, 'Bug', 0)]);

    await act(async () => { await result.current.addTemplate({ name: 'Bug', title: '$t', details: '', color: '#fff', category_id: null }); });

    expect(mockAddTemplate).toHaveBeenCalledWith(1, { name: 'Bug', title: '$t', details: '', color: '#fff', category_id: null });
    expect(result.current.templates.map(t => t.id)).toEqual([5]);
  });

  it('updateTemplate is optimistic and saves', async () => {
    mockGetTemplates.mockResolvedValue([tpl(1, 'Bug', 0)]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.templates).toHaveLength(1));

    await act(async () => { await result.current.updateTemplate(1, { name: 'Defect', title: '$t', details: 'd', color: '#000', category_id: 2 }); });

    expect(result.current.templates[0]).toMatchObject({ id: 1, name: 'Defect', details: 'd', color: '#000', category_id: 2 });
    expect(mockUpdateTemplate).toHaveBeenCalledWith(1, { name: 'Defect', title: '$t', details: 'd', color: '#000', category_id: 2 });
  });

  it('a failed template update reloads the saved copy', async () => {
    mockGetTemplates.mockResolvedValue([tpl(1, 'Bug', 0)]);
    mockUpdateTemplate.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.templates).toHaveLength(1));

    await act(async () => { await result.current.updateTemplate(1, { name: 'Defect', title: '', details: '', color: '#000', category_id: null }); });

    expect(result.current.templates[0].name).toBe('Bug');
  });

  it('deleteTemplate removes it immediately and from the DB', async () => {
    mockGetTemplates.mockResolvedValue([tpl(1, 'Bug', 0), tpl(2, 'Task', 1)]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.templates).toHaveLength(2));

    await act(async () => { await result.current.deleteTemplate(1); });

    expect(result.current.templates.map(t => t.id)).toEqual([2]);
    expect(mockDeleteTemplate).toHaveBeenCalledWith(1);
  });

  it('reorderTemplates reorders optimistically and renumbers sort_order', async () => {
    mockGetTemplates.mockResolvedValue([tpl(1, 'A', 0), tpl(2, 'B', 1), tpl(3, 'C', 2)]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.templates).toHaveLength(3));

    await act(async () => { await result.current.reorderTemplates([3, 1, 2]); });

    expect(result.current.templates.map(t => t.id)).toEqual([3, 1, 2]);
    expect(result.current.templates.map(t => t.sort_order)).toEqual([0, 1, 2]);
    expect(mockReorderTemplates).toHaveBeenCalledWith([3, 1, 2]);
  });

  it('addObjective passes details through to the DB', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.addObjective('Fix', 3, false, { bucketId: 9, inMission: false, details: '# Notes' }); });

    expect(mockAddObjective).toHaveBeenCalledWith(1, 'Fix', 3, 0, false, 9, '# Notes');
  });

  it('duplicateObjective calls the DB and reloads the pool', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const copy = { id: 5, text: 'Copy', created_at: '2023-01-02' };
    mockGetObjectives.mockResolvedValue([copy]);
    await act(async () => { await result.current.duplicateObjective(1); });

    expect(mockDuplicateObjective).toHaveBeenCalledWith(1);
    expect(result.current.objectivePool).toEqual([copy]);
  });

  it('reorderCategories reorders optimistically and saves the order', async () => {
    const cat = (id: number, sort_order: number) => ({ id, label: `C${id}`, color: '#fff', sort_order, coin_bounty: 25 });
    mockGetCategories.mockResolvedValue([cat(1, 0), cat(2, 1), cat(3, 2)]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.categories).toHaveLength(3));

    await act(async () => { await result.current.reorderCategories([3, 1, 2]); });

    expect(result.current.categories.map(c => c.id)).toEqual([3, 1, 2]);
    expect(result.current.categories.map(c => c.sort_order)).toEqual([0, 1, 2]);
    expect(mockReorderCategories).toHaveBeenCalledWith([3, 1, 2]);
  });

  it('a failed category reorder reloads the saved order', async () => {
    const cat = (id: number, sort_order: number) => ({ id, label: `C${id}`, color: '#fff', sort_order, coin_bounty: 25 });
    mockGetCategories.mockResolvedValue([cat(1, 0), cat(2, 1)]);
    mockReorderCategories.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.categories).toHaveLength(2));

    await act(async () => { await result.current.reorderCategories([2, 1]); });

    expect(result.current.categories.map(c => c.id)).toEqual([1, 2]);
  });

  it('provides focus data and loading state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.recentSessions).toEqual([]);
    expect(result.current.dailyStats).toEqual([]);
    expect(result.current.objectivePool).toEqual([]);
  });

  it('populates objectivePool from DB on mount', async () => {
    const mockObjectives = [{ id: 1, text: 'Test Objective', created_at: '2023-01-01' }];
    mockGetObjectives.mockResolvedValueOnce(mockObjectives);

    const { result } = renderHook(() => useFocus(), { wrapper });

    await waitFor(() => {
      expect(result.current.objectivePool).toEqual(mockObjectives);
    }, { timeout: 2000 });
  });

  it('addObjective calls DB and refreshes state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newObjective = { id: 2, text: 'New Objective', created_at: '2023-01-02' };
    mockGetObjectives.mockResolvedValue([newObjective]);

    await act(async () => {
      await result.current.addObjective('New Objective');
    });

    expect(mockAddObjective).toHaveBeenCalledWith(1, 'New Objective', undefined, 1, false, null, null);
    expect(result.current.objectivePool).toEqual([newObjective]);
  });

  it('deleteObjective calls DB and refreshes state', async () => {
    const initialObjectives = [{ id: 1, text: 'Test Objective', created_at: '2023-01-01' }];
    mockGetObjectives.mockResolvedValueOnce(initialObjectives);

    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toEqual(initialObjectives));

    mockGetObjectives.mockResolvedValue([]);

    await act(async () => {
      await result.current.deleteObjective(1);
    });

    expect(mockDeleteObjective).toHaveBeenCalledWith(1);
    expect(result.current.objectivePool).toEqual([]);
  });

  it('setActiveObjective updates local state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActiveObjective(42);
    });

    expect(result.current.activeObjectiveId).toBe(42);
  });

  it('neutralizeObjective triggers glitching and completes objective', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      // Don't await here because we want to check isGlitching immediately
      result.current.neutralizeObjective(1);
    });

    expect(result.current.isGlitching).toBe(true);
    expect(mockCompleteObjective).toHaveBeenCalledWith(1);

    // Wait for glitching to end (2800ms + some buffer)
    await waitFor(() => expect(result.current.isGlitching).toBe(false), { timeout: 4000 });
  });

  it('neutralizeObjective calls completeObjective, not deleteObjective', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.neutralizeObjective(1);
    });

    expect(mockCompleteObjective).toHaveBeenCalledWith(1);
    expect(mockDeleteObjective).not.toHaveBeenCalled();
  });

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
        1,
        '2024-03-24T09:00:00.000Z',
        120,
        []
      );
    });
  });

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
        1,
        '2024-03-24T09:00:00.000Z',
        120,
        ['2024-03-24T09:05:00.000Z', '2024-03-24T09:12:00.000Z']
      );
    });
  });

  it('does not save sessions under 60 seconds', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('timer-saved', { 
        detail: { durationSeconds: 30 } 
      }));
    });

    // Wait a bit to ensure it WASN'T called
    await new Promise(r => setTimeout(r, 100));
    expect(mockSaveSession).not.toHaveBeenCalled();
  });

  it('loads buckets and groups objectives by bucket', async () => {
    mockGetObjectives.mockResolvedValue([
      { id: 1, text: 'a', created_at: '', is_mission: 1, bucket_id: 9, bucket_sort_order: 1 },
      { id: 2, text: 'b', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 },
      { id: 3, text: 'c', created_at: '', is_mission: 0, bucket_id: null, bucket_sort_order: null },
    ]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    expect(result.current.objectivesByBucket.get(9)!.map(o => o.id)).toEqual([2, 1]);
    expect(result.current.objectivesByBucket.get(2)!.map(o => o.id)).toEqual([3]);
    expect(result.current.missionObjectives.map(o => o.id)).toEqual([1]);
  });

  it('deadlineObjectives lists open objectives that have a deadline, and the Deadlines bucket holds no tasks', async () => {
    const DEADLINES = { id: 3, name: 'Deadlines', color: '#f55', sort_order: 2, kind: 'deadlines', x: 0, y: 0, w: 1, h: 1 };
    mockGetBuckets.mockResolvedValue([UNSORTED, DEADLINES, WORK]);
    mockGetObjectives.mockResolvedValue([
      { id: 1, text: 'a', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0, deadline_at: '2026-12-24T10:00:00.000Z' },
      { id: 2, text: 'b', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 1, deadline_at: null },
    ]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(3));
    expect(result.current.deadlineObjectives.map(o => o.id)).toEqual([1]);
    expect(result.current.objectivesByBucket.has(3)).toBe(false);
  });

  it('setObjectiveDeadline updates optimistically and saves; null removes it', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));
    await act(async () => { await result.current.setObjectiveDeadline(4, '2026-12-24T10:00:00.000Z'); });
    expect(mockUpdateObjectiveDeadline).toHaveBeenCalledWith(4, '2026-12-24T10:00:00.000Z');
    expect(result.current.deadlineObjectives.map(o => o.id)).toEqual([4]);
    await act(async () => { await result.current.setObjectiveDeadline(4, null); });
    expect(mockUpdateObjectiveDeadline).toHaveBeenLastCalledWith(4, null);
    expect(result.current.deadlineObjectives).toEqual([]);
  });

  it('a failed deadline save reloads the saved objectives', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));
    mockUpdateObjectiveDeadline.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await result.current.setObjectiveDeadline(4, '2026-12-24T10:00:00.000Z'); });
    expect(result.current.deadlineObjectives).toEqual([]);
  });

  it('addObjective with bucket options passes them to the DB', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addObjective('In work', 5, false, { bucketId: 9, inMission: false });
    });
    expect(mockAddObjective).toHaveBeenCalledWith(1, 'In work', 5, 0, false, 9, null);
  });

  it('setObjectiveMission updates optimistically and keeps the bucket', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));
    await act(async () => { await result.current.setObjectiveMission(4, true); });
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(4, 1);
    expect(result.current.objectivePool[0]).toMatchObject({ is_mission: 1, bucket_id: 9 });
  });

  it('setObjectiveMission moves the objective to the end of Mission, like the DB does', async () => {
    mockGetObjectives.mockResolvedValue([
      { id: 4, text: 'x', created_at: '', is_mission: 0, sort_order: 0, bucket_id: 9, bucket_sort_order: 0 },
      { id: 5, text: 'm1', created_at: '', is_mission: 1, sort_order: 0, bucket_id: 9, bucket_sort_order: 1 },
      { id: 6, text: 'm2', created_at: '', is_mission: 1, sort_order: 1, bucket_id: 9, bucket_sort_order: 2 },
    ]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(3));
    await act(async () => { await result.current.setObjectiveMission(4, true); });
    expect(result.current.missionObjectives.map(o => o.id)).toEqual([5, 6, 4]);
    expect(result.current.objectivePool.find(o => o.id === 4)).toMatchObject({ sort_order: 2 });
  });

  it('moveObjectiveToBucket updates optimistically and reverts on failure', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 1, bucket_id: 2, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));

    await act(async () => { await result.current.moveObjectiveToBucket(4, 9); });
    expect(mockMoveObjectiveToBucket).toHaveBeenCalledWith(4, 9);
    expect(result.current.objectivePool[0]).toMatchObject({ bucket_id: 9, is_mission: 1 });

    mockMoveObjectiveToBucket.mockRejectedValueOnce(new Error('boom'));
    await act(async () => { await result.current.moveObjectiveToBucket(4, 2); });
    await waitFor(() => expect(result.current.objectivePool[0].bucket_id).toBe(2)); // reverted via refreshData (DB still says 2)
  });

  it('updateBucketGeometry updates local bucket state immediately', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    await act(async () => { await result.current.updateBucketGeometry(9, { x: 1, y: 2, w: 300, h: 200 }); });
    expect(result.current.buckets.find(b => b.id === 9)).toMatchObject({ x: 1, y: 2, w: 300, h: 200 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 1, y: 2, w: 300, h: 200 });
  });

  it('bringBucketToFront gives the bucket the highest sort_order and saves it', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    await act(async () => { await result.current.bringBucketToFront(2); });
    expect(result.current.buckets.find(b => b.id === 2)!.sort_order).toBe(3);
    expect(result.current.buckets.map(b => b.id)).toEqual([9, 2]);
    expect(mockBringBucketToFront).toHaveBeenCalledWith(2);
  });

  it('bringBucketToFront skips the DB write when the bucket is already in front', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    await act(async () => { await result.current.bringBucketToFront(9); });
    expect(mockBringBucketToFront).not.toHaveBeenCalled();
  });

  it('deleteBucket calls DB and refreshes', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    mockGetBuckets.mockResolvedValue([UNSORTED]);
    await act(async () => { await result.current.deleteBucket(9); });
    expect(mockDeleteBucket).toHaveBeenCalledWith(9);
    expect(result.current.buckets).toEqual([UNSORTED]);
  });
});
