import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import type { Bucket, CanvasNote, StrategicObjective, Template } from '../types';
import { BucketsPage } from './BucketsPage';

const mockAddObjective = vi.fn();
const mockAddBucket = vi.fn();
const mockUpdateBucketGeometry = vi.fn();
const mockBringBucketToFront = vi.fn();
const mockSetObjectiveMission = vi.fn();
const mockDuplicateObjective = vi.fn();
const mockAddTemplate = vi.fn();
const mockDeleteBucket = vi.fn();
const mockDuplicateNote = vi.fn();
const mockSetViewedObjective = vi.fn();
const mockDeleteObjective = vi.fn();
let mockViewedId: number | null = null;
let mockTemplates: Template[] = [];

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
    deleteObjective: mockDeleteObjective,
    duplicateObjective: mockDuplicateObjective,
    updateObjectiveCategory: vi.fn(),
    setObjectiveMission: mockSetObjectiveMission,
    moveObjectiveToBucket: vi.fn(),
    reorderBucketObjectives: vi.fn(),
    reorderObjectives: vi.fn(),
    addBucket: mockAddBucket,
    updateBucket: vi.fn(),
    updateBucketGeometry: mockUpdateBucketGeometry,
    bringBucketToFront: mockBringBucketToFront,
    deleteBucket: mockDeleteBucket,
    setViewedObjective: mockSetViewedObjective,
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
    templates: mockTemplates,
    addTemplate: mockAddTemplate,
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

const mockCopyPlain = vi.fn();
vi.mock('../utils/clipboard', () => ({
  copyPlain: (text: string) => mockCopyPlain(text),
  copyRich: vi.fn(),
}));

const mockAddNote = vi.fn();
let mockNotes: CanvasNote[] = [];
vi.mock('../hooks/useCanvasNotes', () => ({
  useCanvasNotes: () => ({
    notes: mockNotes,
    addNote: mockAddNote,
    duplicateNote: mockDuplicateNote,
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
    mockDuplicateObjective.mockClear();
    mockAddTemplate.mockClear();
    mockDeleteBucket.mockClear();
    mockDuplicateNote.mockClear();
    mockSetViewedObjective.mockClear();
    mockDeleteObjective.mockClear();
    mockViewedId = null;
    mockTemplates = [];
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

  it('Space flies to the Mission panel at 100% zoom when nothing was selected yet', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.keyDown(window, { key: ' ' });
    // jsdom rects are 0×0; the Mission panel's center is (-190, 210)
    await waitFor(() => expect(world.style.transform).toBe('translate(190px, -210px) scale(1)'));
  });

  it('the fly is animated: the view is not at the target right away', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.keyDown(window, { key: ' ' });
    expect(world.style.transform).toBe('translate(-500px, -500px) scale(1.5)');
    await waitFor(() => expect(world.style.transform).toBe('translate(190px, -210px) scale(1)'));
  });

  it('wheel zooming stops a fly in progress', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.wheel(world, { deltaY: -100 });
    await new Promise(resolve => setTimeout(resolve, 800));
    expect(world.style.transform).not.toBe('translate(190px, -210px) scale(1)');
  });

  it('Space flies to the bucket of the task selected last on this visit', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.click(document.querySelector('[data-objective-id="101"]') as HTMLElement); // in Work, center (490, 210)
    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
  });

  it('double-clicking empty space in a bucket flies to it at 100% zoom', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 0.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const body = document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement;
    fireEvent.doubleClick(body);
    await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
  });

  it("double-clicking a control or a task's category dot does not fly", async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 0.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.doubleClick(screen.getAllByTitle('Bucket color')[0]);
    fireEvent.doubleClick(document.querySelector('[data-objective-id="101"] span') as HTMLElement); // the category dot
    await new Promise(resolve => setTimeout(resolve, 800));
    expect(world.style.transform).toBe('translate(-500px, -500px) scale(0.5)');
  });

  it('double-clicking a task flies to its bucket (rename is in the right-click menu)', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 0.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.doubleClick(card.querySelector('span:last-of-type') as HTMLElement);
    expect(within(card).queryByDisplayValue('Beta')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
  });

  it('double-clicking works when the pan captured the pointer (the event then targets the viewport)', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 0.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const body = document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => body;
    try {
      fireEvent.doubleClick(screen.getByTestId('canvas-world').parentElement as HTMLElement, { clientX: 5, clientY: 5 });
      await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
    } finally {
      document.elementFromPoint = original;
    }
  });

  describe('focusing a bucket', () => {
    const panel = (id: number) => document.querySelector(`[data-bucket-id="${id}"]`) as HTMLElement;
    const dimmed = (id: number) => /dimmed/.test(panel(id).className);

    it('nothing is dimmed until a bucket is focused', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      for (const id of [1, 2, 9]) expect(dimmed(id)).toBe(false);
    });

    it('double-clicking a bucket focuses it and dims the others', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.doubleClick(screen.getByText('Work'));
      expect(dimmed(9)).toBe(false);
      expect(dimmed(1)).toBe(true);
      expect(dimmed(2)).toBe(true);
    });

    it('Tab does nothing while no bucket is focused', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      for (const id of [1, 2, 9]) expect(dimmed(id)).toBe(false);
    });

    it('Tab focuses the next bucket: the virtual ones first, then by id, wrapping around', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.doubleClick(screen.getByText('Work')); // order: Mission (1), Unsorted (2), Work (9)
      fireEvent.keyDown(window, { key: 'Tab' });       // wraps to Mission
      expect(dimmed(1)).toBe(false);
      expect(dimmed(9)).toBe(true);
      fireEvent.keyDown(window, { key: 'Tab' });
      expect(dimmed(2)).toBe(false);
      expect(dimmed(1)).toBe(true);
    });

    it('Shift+Tab goes back', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.doubleClick(screen.getByText('Unsorted'));
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
      expect(dimmed(1)).toBe(false);
      expect(dimmed(2)).toBe(true);
    });

    it('Tab flies to the newly focused bucket', async () => {
      localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.doubleClick(screen.getByText('Unsorted'));
      fireEvent.keyDown(window, { key: 'Tab' }); // Work, center (490, 210)
      await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
    });

    it('Escape clears the focus first, and only then leaves the page', () => {
      const onBack = vi.fn();
      render(<BucketsPage onBack={onBack} />);
      fireEvent.doubleClick(screen.getByText('Work'));
      fireEvent.keyDown(window, { key: 'Escape' });
      for (const id of [1, 2, 9]) expect(dimmed(id)).toBe(false);
      expect(onBack).not.toHaveBeenCalled();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onBack).toHaveBeenCalledOnce();
    });

    it("Escape typed in a panel's add box clears the focus and leaves the box", () => {
      const onBack = vi.fn();
      render(<BucketsPage onBack={onBack} />);
      fireEvent.doubleClick(screen.getByText('Work'));
      const input = within(panel(9)).getByPlaceholderText('Add Objective...');
      input.focus();
      fireEvent.change(input, { target: { value: 'half typed' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      for (const id of [1, 2, 9]) expect(dimmed(id)).toBe(false);
      expect(input).not.toHaveFocus();
      expect(input).toHaveValue('half typed');
      expect(onBack).not.toHaveBeenCalled();
    });

    it('Escape typed in an add box with nothing focused does nothing', () => {
      const onBack = vi.fn();
      render(<BucketsPage onBack={onBack} />);
      fireEvent.keyDown(screen.getAllByPlaceholderText('Add Objective...')[0], { key: 'Escape' });
      expect(onBack).not.toHaveBeenCalled();
    });

    it('Tab typed in an input is left alone', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.doubleClick(screen.getByText('Work'));
      fireEvent.keyDown(screen.getAllByPlaceholderText('Add Objective...')[0], { key: 'Tab' });
      expect(dimmed(9)).toBe(false);
      expect(dimmed(1)).toBe(true);
    });
  });

  it('double-clicking a bucket header flies to it', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 0.5 }));
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.doubleClick(screen.getByText('Work'));
    await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-490px, -210px) scale(1)'));
  });

  it('after a double-click, Space flies back to that bucket', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    fireEvent.doubleClick(document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement);
    await waitFor(() => expect(world.style.transform).toBe('translate(-490px, -210px) scale(1)'));
    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => expect(world.style.transform).toBe('translate(-490px, -210px) scale(1)'));
  });

  it('with the details drawer open, Space centers in the space beside it', async () => {
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: 0, panY: 0, zoom: 1 }));
    render(<BucketsPage onBack={vi.fn()} />);
    const world = screen.getByTestId('canvas-world');
    (world.parentElement as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 } as DOMRect);
    fireEvent.click(document.querySelector('[data-objective-id="101"]') as HTMLElement); // Work, center (490, 210); drawer 420 wide
    fireEvent.keyDown(window, { key: ' ' });
    // visible width 580 → its middle is x=290
    await waitFor(() => expect(world.style.transform).toBe('translate(-200px, 90px) scale(1)'));
  });

  it('a task selected before opening the canvas does not count', async () => {
    mockViewedId = 101;
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(190px, -210px) scale(1)'));
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

  it('NEW_PANEL button calls addBucket with a default geometry', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('NEW_PANEL'));
    expect(mockAddBucket).toHaveBeenCalledWith('NEW_BUCKET', expect.stringMatching(/^#/), expect.objectContaining({ w: 300, h: 420 }));
  });

  describe('deleting a bucket', () => {
    const openDeleteDialog = () => {
      fireEvent.contextMenu(screen.getByText('Work'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    };

    it('asks in an in-app dialog, not a native confirm', () => {
      const nativeConfirm = vi.spyOn(window, 'confirm');
      render(<BucketsPage onBack={vi.fn()} />);
      openDeleteDialog();
      expect(screen.getByRole('dialog', { name: 'DELETE_BUCKET' })).toBeInTheDocument();
      expect(screen.getByText(/Work/, { selector: 'p' })).toHaveTextContent(/UNSORTED/);
      expect(nativeConfirm).not.toHaveBeenCalled();
      expect(mockDeleteBucket).not.toHaveBeenCalled();
      nativeConfirm.mockRestore();
    });

    it('confirming deletes the bucket', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      openDeleteDialog();
      fireEvent.click(screen.getByRole('button', { name: 'DELETE' }));
      expect(mockDeleteBucket).toHaveBeenCalledWith(9);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('cancelling keeps the bucket', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      openDeleteDialog();
      fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
      expect(mockDeleteBucket).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('Escape cancels without leaving the page', () => {
      const onBack = vi.fn();
      render(<BucketsPage onBack={onBack} />);
      openDeleteDialog();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(mockDeleteBucket).not.toHaveBeenCalled();
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  it('keeps the template buttons and the add box in one footer, with one divider above them', () => {
    mockTemplates = [{ id: 1, name: 'Bug', title: '$t', details: '', color: '#f44', category_id: null, sort_order: 0 }];
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    const footer = within(panel).getByPlaceholderText('Add Objective...').closest('[class*="footer"]') as HTMLElement;
    expect(footer).not.toBeNull();
    expect(footer).toContainElement(within(panel).getByRole('button', { name: 'Bug' }));
  });

  it('panels have no header buttons for deleting', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    expect(screen.queryByTitle('Delete bucket')).toBeNull();
  });

  it('system buckets have no Delete in their right-click menu, custom ones do', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(screen.getByText('Unsorted'));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rename']);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.contextMenu(screen.getByText('Work'));
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Rename', 'Delete']);
  });

  it('the Mission panel header has no right-click menu', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(screen.getByText('MISSION_OBJECTIVES'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('wheel over the details drawer does not zoom the canvas', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.click(card);
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

  it('Rename in the header right-click menu opens rename; double-clicking the header does not', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    fireEvent.doubleClick(screen.getByText('Work').parentElement as HTMLElement);
    expect(within(panel).queryByDisplayValue('Work')).toBeNull();
    fireEvent.contextMenu(screen.getByText('Work'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
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
    // No buttons at all; everything lives in the right-click menu
    expect(card.querySelectorAll('button')).toHaveLength(0);
  });

  it('the card menu offers Rename, Details, Mission toggle, Duplicate, Copy text, template and Delete', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'Rename', 'Details', 'Add to Mission', 'Duplicate', 'Copy text', 'Create template from task', 'Delete',
    ]);
  });

  it('a card in the Mission panel offers Remove from Mission', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const missionCard = within(screen.getByText('MISSION_OBJECTIVES').closest('[data-bucket-id]') as HTMLElement)
      .getByText('Alpha').closest('[data-objective-id]') as HTMLElement;
    fireEvent.contextMenu(missionCard);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Mission' }));
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(100, false);
  });

  it('Delete in the card menu deletes the objective', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(mockDeleteObjective).toHaveBeenCalledWith(101);
  });

  it('Rename in the card menu starts inline rename', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.contextMenu(card);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(within(card).getByDisplayValue('Beta')).toBeInTheDocument();
  });

  it('Mission panel cards are tinted with their bucket color; bucket cards are not', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const missionCard = within(screen.getByText('MISSION_OBJECTIVES').closest('[data-bucket-id]') as HTMLElement)
      .getByText('Alpha').closest('[data-objective-id]') as HTMLElement;
    expect(missionCard.style.background).toContain('color-mix');
    const bucketCard = document.querySelector('[data-bucket-id="9"] [data-objective-id="101"]') as HTMLElement;
    expect(bucketCard.style.background).toBe('');
  });

  it('there is no Add button beside the add box; Enter still adds', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
    expect(within(panel).queryByTitle('Add objective')).toBeNull();
    const input = within(panel).getByPlaceholderText('Add Objective...');
    fireEvent.change(input, { target: { value: 'New one' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockAddObjective).toHaveBeenCalled();
  });

  describe('details drawer', () => {
    const card = () => document.querySelector('[data-objective-id="101"]') as HTMLElement;

    it('clicking a task opens the drawer', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      expect(screen.queryByTestId('details')).toBeNull();
      fireEvent.click(card());
      expect(screen.getByTestId('details')).toBeInTheDocument();
    });

    it('pressing elsewhere does not close it (only Escape or its close button do)', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.click(card());
      for (const el of [
        screen.getByTestId('canvas-world'),
        document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement,
        screen.getByTestId('details'),
        card(),
      ]) {
        fireEvent.pointerDown(el);
        fireEvent.mouseDown(el);
      }
      expect(screen.getByTestId('details')).toBeInTheDocument();
      expect(mockSetViewedObjective).not.toHaveBeenCalledWith(null);
    });

    it('clicking another task switches the drawer to it', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.click(card());
      fireEvent.click(document.querySelector('[data-objective-id="100"]') as HTMLElement);
      expect(mockSetViewedObjective).toHaveBeenLastCalledWith(100);
      expect(screen.getByTestId('details')).toBeInTheDocument();
    });

    it('Escape closes it and deselects without leaving the page', () => {
      const onBack = vi.fn();
      render(<BucketsPage onBack={onBack} />);
      fireEvent.click(card());
      mockSetViewedObjective.mockClear();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('details')).toBeNull();
      expect(mockSetViewedObjective).toHaveBeenCalledWith(null);
      expect(onBack).not.toHaveBeenCalled();
    });

    it('dragging its left edge resizes it, within limits', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.click(card());
      const drawer = screen.getByTestId('details').parentElement as HTMLElement;
      Object.defineProperty(drawer.parentElement, 'clientWidth', { value: 1200, configurable: true });
      const handle = within(drawer).getByTitle('Resize');
      expect(drawer.style.width).toBe('420px');
      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 500, clientY: 0 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400, clientY: 0 });
      expect(drawer.style.width).toBe('520px');
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 2000, clientY: 0 });
      expect(drawer.style.width).toBe('280px');
      fireEvent.pointerUp(handle, { pointerId: 1 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100, clientY: 0 });
      expect(drawer.style.width).toBe('280px');
    });
  });

  it('right-clicking a card offers Duplicate, which duplicates that objective', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const card = document.querySelector('[data-objective-id="101"]') as HTMLElement;
    fireEvent.contextMenu(card, { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(mockDuplicateObjective).toHaveBeenCalledWith(101);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('right-clicking a card offers Create template from task, which saves a template and leaves the task', async () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create template from task' }));
    expect(screen.getByRole('dialog', { name: 'CREATE_TEMPLATE' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SAVE_TEMPLATE' }));
    expect(mockAddTemplate).toHaveBeenCalledWith({ name: 'Beta', title: 'Beta', details: '', color: '#ee682b', category_id: null });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector('[data-objective-id="101"]')).not.toBeNull();
  });

  it('right-clicking a card offers Copy text, which copies the objective text', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy text' }));
    expect(mockCopyPlain).toHaveBeenCalledWith('Beta');
  });

  it('Escape closes the card menu without leaving the page', () => {
    const onBack = vi.fn();
    render(<BucketsPage onBack={onBack} />);
    fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Duplicate in a note's right-click menu duplicates that note", () => {
    mockNotes = [NOTE(1)];
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.contextMenu(document.querySelector('[data-note-id="1"]') as HTMLElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(mockDuplicateNote).toHaveBeenCalledWith(1);
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

  it('plain wheel zooms the canvas anywhere, including over a note and a task list', () => {
    mockNotes = [NOTE(1)];
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.wheel(screen.getByText('note 1'), { deltaY: 100 });
    const zoomedOnNote = screen.getByText(/%$/).textContent;
    expect(zoomedOnNote).not.toBe('100%');
    fireEvent.wheel(document.querySelector('[data-objective-id="101"]') as HTMLElement, { deltaY: 100 });
    expect(screen.getByText(/%$/).textContent).not.toBe(zoomedOnNote);
  });

  describe('Shift: zoom and pan from anywhere', () => {
    const VIEWPORT = JSON.stringify({ panX: 100, panY: 50, zoom: 1 });
    const world = () => screen.getByTestId('canvas-world');
    const viewport = () => world().parentElement as HTMLElement;
    const transform = () => world().style.transform;
    const press = (el: Element, init: PointerEventInit = {}) =>
      fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0, ...init });
    const dragTo = (x: number, y: number) =>
      fireEvent.pointerMove(viewport(), { pointerId: 1, buttons: 1, clientX: x, clientY: y });

    beforeEach(() => localStorage.setItem('bucket_canvas_viewport', VIEWPORT));

    it('Shift+wheel over a list with a scrollbar scrolls it instead of zooming', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      const body = document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement;
      Object.defineProperty(body, 'scrollHeight', { value: 500, configurable: true });
      Object.defineProperty(body, 'clientHeight', { value: 100, configurable: true });
      fireEvent.wheel(document.querySelector('[data-objective-id="101"]') as HTMLElement, { deltaX: 40, deltaY: 0, shiftKey: true });
      expect(body.scrollTop).toBe(40);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('Shift+wheel over a list without a scrollbar zooms', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.wheel(document.querySelector('[data-objective-id="101"]') as HTMLElement, { deltaY: -500, shiftKey: true });
      expect(screen.queryByText('100%')).toBeNull();
    });

    it('zooms when the browser reports Shift+wheel as a horizontal scroll', () => {
      mockNotes = [NOTE(1)];
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.wheel(screen.getByText('note 1'), { deltaX: -500, deltaY: 0, shiftKey: true });
      expect(screen.queryByText('100%')).toBeNull();
    });

    it('wheel in the opposite direction zooms out', () => {
      mockNotes = [NOTE(1)];
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.wheel(screen.getByText('note 1'), { deltaY: 500 });
      const readout = Number(screen.getByText(/%$/).textContent!.replace('%', ''));
      expect(readout).toBeLessThan(100);
    });

    it('plain drag on empty space inside a panel pans the canvas', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(document.querySelector('[data-bucket-id="9"] [data-canvas-scroll]') as HTMLElement);
      dragTo(40, 10);
      expect(transform()).toBe('translate(140px, 60px) scale(1)');
    });

    it('plain drag on the add box does not pan', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(within(screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement).getByPlaceholderText('Add Objective...'));
      dragTo(40, 10);
      expect(transform()).toBe('translate(100px, 50px) scale(1)');
    });

    it('Shift+drag from a task card pans the canvas', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(document.querySelector('[data-objective-id="101"]') as HTMLElement, { shiftKey: true });
      dragTo(40, 10);
      expect(transform()).toBe('translate(140px, 60px) scale(1)');
    });

    it('Shift+drag from a note pans the canvas and leaves the note where it is', () => {
      mockNotes = [NOTE(1)];
      render(<BucketsPage onBack={vi.fn()} />);
      const note = document.querySelector('[data-note-id="1"]') as HTMLElement;
      const before = { left: note.style.left, top: note.style.top };
      press(screen.getByText('note 1'), { shiftKey: true });
      dragTo(60, 20);
      expect(transform()).toBe('translate(160px, 70px) scale(1)');
      expect({ left: note.style.left, top: note.style.top }).toEqual(before);
    });

    it('Shift+drag from a panel header pans the canvas and leaves the panel where it is', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
      const before = { left: panel.style.left, top: panel.style.top };
      press(screen.getByText('Work').parentElement as HTMLElement, { shiftKey: true });
      dragTo(30, 30);
      expect(transform()).toBe('translate(130px, 80px) scale(1)');
      expect({ left: panel.style.left, top: panel.style.top }).toEqual(before);
    });

    it('stops panning on release', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(document.querySelector('[data-objective-id="101"]') as HTMLElement, { shiftKey: true });
      dragTo(40, 10);
      fireEvent.pointerUp(viewport(), { pointerId: 1 });
      dragTo(200, 200);
      expect(transform()).toBe('translate(140px, 60px) scale(1)');
    });

    it('without Shift, pressing a card does not pan', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(document.querySelector('[data-objective-id="101"]') as HTMLElement);
      dragTo(40, 10);
      expect(transform()).toBe('translate(100px, 50px) scale(1)');
    });

    it('Shift on a button still presses the button instead of panning', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      press(screen.getAllByTitle('Bucket color')[0], { shiftKey: true });
      dragTo(40, 10);
      expect(transform()).toBe('translate(100px, 50px) scale(1)');
    });

    it('Shift in a note\'s text box keeps selecting text instead of panning', () => {
      mockNotes = [NOTE(1)];
      render(<BucketsPage onBack={vi.fn()} />);
      const note = document.querySelector('[data-note-id="1"]') as HTMLElement;
      fireEvent.doubleClick(note);
      press(within(note).getByRole('textbox'), { shiftKey: true });
      dragTo(40, 10);
      expect(transform()).toBe('translate(100px, 50px) scale(1)');
    });

    it('Shift in a dialog opened from the canvas never pans', () => {
      render(<BucketsPage onBack={vi.fn()} />);
      fireEvent.contextMenu(document.querySelector('[data-objective-id="101"]') as HTMLElement);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Create template from task' }));
      press(screen.getByRole('dialog', { name: 'CREATE_TEMPLATE' }), { shiftKey: true });
      dragTo(40, 10);
      expect(transform()).toBe('translate(100px, 50px) scale(1)');
    });
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
