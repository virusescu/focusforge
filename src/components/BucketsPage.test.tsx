import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { Bucket, CanvasNote, StrategicObjective } from '../types';
import { BucketsPage } from './BucketsPage';

const mockAddObjective = vi.fn();
const mockAddBucket = vi.fn();
const mockUpdateBucketGeometry = vi.fn();
const mockBringBucketToFront = vi.fn();
const mockSetObjectiveMission = vi.fn();
let mockViewedId: number | null = null;

const BUCKETS: Bucket[] = [
  { id: 1, name: 'Mission', color: '#ee682b', sort_order: 0, kind: 'mission', x: -340, y: 0, w: 300, h: 420 },
  { id: 2, name: 'Unsorted', color: '#888888', sort_order: 1, kind: 'unsorted', x: 0, y: 0, w: 300, h: 420 },
  { id: 9, name: 'Work', color: '#3388ff', sort_order: 2, kind: 'custom', x: 340, y: 0, w: 300, h: 420 },
];

const OBJ_A: StrategicObjective = {
  id: 100, text: 'Alpha', created_at: '2026-10-13T00:00:00Z', is_mission: 1,
  bucket_id: 2, bucket_sort_order: 0, sort_order: 0, category_id: null,
};
const OBJ_B: StrategicObjective = {
  id: 101, text: 'Beta', created_at: '2026-10-13T00:00:00Z', is_mission: 0,
  bucket_id: 9, bucket_sort_order: 0, sort_order: 1, category_id: null,
};

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    buckets: BUCKETS,
    objectivePool: [OBJ_A, OBJ_B],
    objectivesByBucket: new Map([[2, [OBJ_A]], [9, [OBJ_B]]]),
    missionObjectives: [OBJ_A],
    categories: [],
    viewedObjectiveId: mockViewedId,
    addObjective: mockAddObjective,
    updateObjective: vi.fn(),
    deleteObjective: vi.fn(),
    updateObjectiveCategory: vi.fn(),
    setObjectiveMission: mockSetObjectiveMission,
    moveObjectiveToBucket: vi.fn(),
    reorderBucketObjectives: vi.fn(),
    reorderObjectives: vi.fn(),
    addBucket: mockAddBucket,
    updateBucket: vi.fn(),
    updateBucketGeometry: mockUpdateBucketGeometry,
    bringBucketToFront: mockBringBucketToFront,
    deleteBucket: vi.fn(),
    setViewedObjective: vi.fn(),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
  }),
}));

vi.mock('../utils/audio', () => ({
  soundEngine: {
    playClick: vi.fn(),
    playHover: vi.fn(),
    playEditStart: vi.fn(),
    playReorder: vi.fn(),
    playNavSelect: vi.fn(),
    playCheckboxUncheck: vi.fn(),
  },
  playCheckboxCheckWithFile: vi.fn(),
}));

vi.mock('./ObjectiveDetails', () => ({
  ObjectiveDetails: () => <div data-testid="details" />,
}));

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));

const mockAddNote = vi.fn();
let mockNotes: CanvasNote[] = [];
vi.mock('../hooks/useCanvasNotes', () => ({
  useCanvasNotes: () => ({
    notes: mockNotes,
    addNote: mockAddNote,
    updateContent: vi.fn(),
    updateColor: vi.fn(),
    updateGeometry: vi.fn(),
    bringToFront: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

const NOTE = (id: number, sort_order = 0): CanvasNote => ({ id, content: `note ${id}`, color: '#ffcc33', x: 0, y: 600, w: 260, h: 200, sort_order });

describe('BucketsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAddObjective.mockClear();
    mockAddBucket.mockClear();
    mockUpdateBucketGeometry.mockClear();
    mockBringBucketToFront.mockClear();
    mockSetObjectiveMission.mockClear();
    mockViewedId = null;
    mockAddNote.mockReset();
    mockNotes = [];
  });

  it('renders one panel per bucket with the mission title', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    expect(screen.getByText('MISSION_OBJECTIVES')).toBeInTheDocument();
    expect(screen.getByText('Unsorted')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('tints a bucket panel with its color', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    expect(panel.getAttribute('data-bucket-id')).toBe('9');
    expect(panel.style.background).toContain('color-mix');
    // jsdom normalizes hex colors to rgb()
    expect(panel.style.background).toMatch(/#3388ff|rgb\(51, 136, 255\)/i);
  });

  it('Space recenters the origin and keeps zoom', () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.keyDown(window, { key: ' ' });
    // jsdom rects are 0×0, so center is (0,0)
    expect(world.style.transform).toBe('translate(0px, 0px) scale(1.5)');
  });

  it('Space typed in an input does not recenter', () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    const input = screen.getAllByPlaceholderText('Add Objective...')[0];
    fireEvent.keyDown(input, { key: ' ' });
    expect(world.style.transform).toBe('translate(-500px, -500px) scale(1)');
  });

  it('Escape calls onBack', () => {
    const onBack = vi.fn();
    render(<BucketsPage onBack={onBack} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalled();
  });

  it('adding in a bucket panel creates a non-mission objective in that bucket', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    const input = within(panel).getByPlaceholderText('Add Objective...');
    fireEvent.change(input, { target: { value: 'Ship it' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockAddObjective).toHaveBeenCalledWith('Ship it', null, false, { bucketId: 9, inMission: false });
  });

  it('NEW_BUCKET calls addBucket with a default geometry', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('NEW_BUCKET'));
    expect(mockAddBucket).toHaveBeenCalledWith('NEW_BUCKET', expect.stringMatching(/^#/), expect.objectContaining({ w: 300, h: 420 }));
  });

  it('system buckets have no delete button', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const unsorted = screen.getByText('Unsorted').closest('[data-bucket-id]') as HTMLElement;
    expect(within(unsorted).queryByTitle('Delete bucket')).toBeNull();
    const work = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    expect(within(work).getByTitle('Delete bucket')).toBeInTheDocument();
  });

  it('wheel over the details drawer does not zoom the canvas', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.click(within(card).getByTitle('Details'));
    const drawer = screen.getByTestId('details');
    fireEvent.wheel(drawer, { deltaY: -500 });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('Escape with the category manager open closes it and stays on the page', () => {
    const onBack = vi.fn();
    render(<BucketsPage onBack={onBack} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.click(card.querySelector('span') as HTMLElement); // category bullet
    fireEvent.click(within(card).getByTitle('Manage Categories'));
    expect(screen.getByText('MANAGE_CATEGORIES')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('MANAGE_CATEGORIES')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('double-clicking a bucket header opens rename', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.doubleClick(header);
    expect(within(panel).getByDisplayValue('Work')).toBeInTheDocument();
  });

  it('header pointerdown alone does not capture the pointer', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    const capture = vi.fn();
    header.setPointerCapture = capture;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 30, clientY: 10 });
    expect(capture).toHaveBeenCalledWith(1);
  });

  it('panel move saves the geometry from the pointerup position', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 50, clientY: 0 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 80, clientY: 20 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 420, y: 20, w: 300, h: 420 });
  });

  it('moving without Shift snaps the saved position to 20', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 53, clientY: 17 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 53, clientY: 17 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 400, y: 20, w: 300, h: 420 });
  });

  it('holding Shift while moving saves the free position in whole units', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, shiftKey: true, clientX: 53, clientY: 17 });
    fireEvent.pointerUp(header, { pointerId: 1, shiftKey: true, clientX: 53, clientY: 17 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 393, y: 17, w: 300, h: 420 });
  });

  it('dropping a moved panel brings it to the front', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Unsorted').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 30, clientY: 0 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 30, clientY: 0 });
    expect(mockBringBucketToFront).toHaveBeenCalledWith(2);
  });

  it('a header click without movement does not change the stacking', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Unsorted').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(mockBringBucketToFront).not.toHaveBeenCalled();
  });

  it('the Mission panel has a color picker', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const mission = screen.getByText('MISSION_OBJECTIVES').closest('[data-bucket-id]') as HTMLElement;
    expect(within(mission).getByTitle('Bucket color')).toBeInTheDocument();
  });

  it('stacks panels by sort_order and lifts the panel being moved', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = (name: string) => screen.getByText(name).closest('[data-bucket-id]') as HTMLElement;
    // Fixture sort_orders are 0, 1, 2
    expect(Number(panel('MISSION_OBJECTIVES').style.zIndex)).toBe(1);
    expect(Number(panel('Unsorted').style.zIndex)).toBe(2);
    expect(Number(panel('Work').style.zIndex)).toBe(3);

    const header = screen.getByText('Unsorted').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 30, clientY: 0 });
    expect(Number(panel('Unsorted').style.zIndex)).toBeGreaterThan(3);
  });

  it('cards have no separate drag handle', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    // Only the action buttons: details, mission toggle, delete
    expect(card.querySelectorAll('button')).toHaveLength(3);
  });

  it('a header click without movement saves nothing', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 1, clientY: 0 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 1, clientY: 0 });
    expect(mockUpdateBucketGeometry).not.toHaveBeenCalled();
  });

  it('F2 while typing in an input does not start renaming the viewed card', () => {
    mockViewedId = 101;
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    const input = within(panel).getByPlaceholderText('Add Objective...');
    input.focus();
    fireEvent.keyDown(input, { key: 'F2' });
    expect(within(panel).queryByDisplayValue('Beta')).toBeNull();
    fireEvent.keyDown(window, { key: 'F2' });
    expect(within(panel).getByDisplayValue('Beta')).toBeInTheDocument();
  });

  it('first visit recenters the origin under StrictMode', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    );
    try {
      render(<StrictMode><BucketsPage onBack={vi.fn()} /></StrictMode>);
      await act(async () => { await new Promise(r => requestAnimationFrame(() => r(null))); });
      expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(400px, 300px) scale(1)');
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('renders notes above every bucket panel', () => {
    mockNotes = [NOTE(1, 0), NOTE(2, 1)];
    render(<BucketsPage onBack={vi.fn()} />);
    const z = (el: Element | null) => Number((el as HTMLElement).style.zIndex);
    const bucketZ = Math.max(...[...document.querySelectorAll('[data-bucket-id]')].map(z));
    const n1 = z(document.querySelector('[data-note-id="1"]'));
    const n2 = z(document.querySelector('[data-note-id="2"]'));
    expect(n1).toBeGreaterThan(bucketZ);
    expect(n2).toBeGreaterThan(n1);
  });

  it('NEW_NOTE adds a default note at the top-right and opens it for editing', async () => {
    mockAddNote.mockImplementation(async () => {
      mockNotes = [{ ...NOTE(50), content: '' }];
      return 50;
    });
    const { rerender } = render(<BucketsPage onBack={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('NEW_NOTE')); });
    expect(mockAddNote).toHaveBeenCalledWith('#ffcc33', expect.objectContaining({ w: 260, h: 200 }));
    const geometry = mockAddNote.mock.calls[0][1];
    // Math.abs: a negative grid value gives -0, which toBe(0) rejects
    expect(Math.abs(geometry.x % 20)).toBe(0);
    expect(Math.abs(geometry.y % 20)).toBe(0);
    rerender(<BucketsPage onBack={vi.fn()} />);
    const note = document.querySelector('[data-note-id="50"]') as HTMLElement;
    expect(within(note).getByRole('textbox')).toBeInTheDocument();
  });

  it('Escape and Space typed in a note editor stay in the note', () => {
    mockNotes = [NOTE(1)];
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
    const onBack = vi.fn();
    render(<BucketsPage onBack={onBack} />);
    const note = document.querySelector('[data-note-id="1"]') as HTMLElement;
    fireEvent.doubleClick(note);
    const ta = within(note).getByRole('textbox');
    fireEvent.keyDown(ta, { key: ' ' });
    expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-500px, -500px) scale(1)');
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
    expect(within(note).queryByRole('textbox')).toBeNull();
  });

  it('wheel over a note does not zoom the canvas', () => {
    mockNotes = [NOTE(1)];
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.wheel(screen.getByText('note 1'), { deltaY: -500 });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('pointerdown on empty canvas closes the note editor', () => {
    mockNotes = [NOTE(1)];
    render(<BucketsPage onBack={vi.fn()} />);
    const n1 = document.querySelector('[data-note-id="1"]') as HTMLElement;
    fireEvent.doubleClick(n1);
    expect(within(n1).getByRole('textbox')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('canvas-world'));
    expect(within(n1).queryByRole('textbox')).toBeNull();
  });

  it('only one note is edited at a time', () => {
    mockNotes = [NOTE(1), NOTE(2, 1)];
    render(<BucketsPage onBack={vi.fn()} />);
    const n1 = document.querySelector('[data-note-id="1"]') as HTMLElement;
    const n2 = document.querySelector('[data-note-id="2"]') as HTMLElement;
    fireEvent.doubleClick(n1);
    expect(within(n1).getByRole('textbox')).toBeInTheDocument();
    fireEvent.pointerDown(n2);
    fireEvent.doubleClick(n2);
    expect(within(n1).queryByRole('textbox')).toBeNull();
    expect(within(n2).getByRole('textbox')).toBeInTheDocument();
  });
});
