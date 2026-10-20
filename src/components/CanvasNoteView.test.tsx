import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { CanvasNote } from '../types';
import { CanvasNoteView, type CanvasNoteViewProps } from './CanvasNoteView';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playEditStart: vi.fn(), playCheckboxUncheck: vi.fn() },
  playCheckboxCheckWithFile: vi.fn(),
}));

const NOTE: CanvasNote = { id: 5, content: '# Title\n\n- [ ] task', color: '#ffcc33', x: 100, y: 40, w: 260, h: 200, sort_order: 0 };

const handlers = {
  onContentChange: vi.fn(),
  onColorChange: vi.fn(),
  onGeometryChange: vi.fn(),
  onBringToFront: vi.fn(),
  onDelete: vi.fn(),
};

// Owns isEditing like BucketsPage does
function Harness({ note = NOTE, startEditing = false }: { note?: CanvasNote; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing);
  const props: CanvasNoteViewProps = {
    note, zoom: 1, zIndex: 10001, isEditing: editing,
    onStartEdit: () => setEditing(true), onEndEdit: () => setEditing(false),
    ...handlers,
  };
  return <><div data-testid="outside" /><CanvasNoteView {...props} /></>;
}

const noteEl = () => document.querySelector('[data-note-id="5"]') as HTMLElement;

describe('CanvasNoteView', () => {
  beforeEach(() => {
    Object.values(handlers).forEach(h => h.mockClear());
  });

  it('renders markdown, tinted with the note color, at its geometry', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(noteEl().style.background).toContain('color-mix');
    expect(noteEl().style.left).toBe('100px');
    expect(noteEl().style.zIndex).toBe('10001');
  });

  it('shows a hint when empty', () => {
    render(<Harness note={{ ...NOTE, content: '' }} />);
    expect(screen.getByText('Double-click to edit')).toBeInTheDocument();
  });

  it('double-click opens the editor with the note text; Esc saves', () => {
    render(<Harness />);
    fireEvent.doubleClick(noteEl());
    const ta = within(noteEl()).getByRole('textbox') as HTMLTextAreaElement;
    expect(ta.value).toBe(NOTE.content);
    expect(within(noteEl()).getByTitle('Table')).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: 'changed' } });
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, 'changed');
    expect(within(noteEl()).queryByRole('textbox')).toBeNull();
  });

  it('Shift+Esc cancels without saving', () => {
    render(<Harness startEditing />);
    const ta = within(noteEl()).getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'changed' } });
    fireEvent.keyDown(ta, { key: 'Escape', shiftKey: true });
    expect(handlers.onContentChange).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
  });

  it('saving unchanged text does not write', () => {
    render(<Harness startEditing />);
    fireEvent.keyDown(within(noteEl()).getByRole('textbox'), { key: 'Escape' });
    expect(handlers.onContentChange).not.toHaveBeenCalled();
  });

  it('pointerdown outside the note saves', () => {
    render(<Harness startEditing />);
    fireEvent.change(within(noteEl()).getByRole('textbox'), { target: { value: 'outside save' } });
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, 'outside save');
  });

  it('pointerdown inside the note (toolbar) does not save', () => {
    render(<Harness startEditing />);
    fireEvent.pointerDown(within(noteEl()).getByTitle('Bold (Ctrl+B)'));
    expect(within(noteEl()).getByRole('textbox')).toBeInTheDocument();
  });

  it('clicking a task checkbox toggles it without starting a drag or editing', () => {
    render(<Harness />);
    const checkbox = screen.getByRole('checkbox');
    const capture = vi.fn();
    noteEl().setPointerCapture = capture;
    fireEvent.pointerDown(checkbox, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(noteEl(), { pointerId: 1, buttons: 1, clientX: 30, clientY: 0 });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, '# Title\n\n- [x] task');
    expect(within(noteEl()).queryByRole('textbox')).toBeNull();
  });

  it('dragging the note body moves it (snapped), brings it to front and saves', () => {
    render(<Harness />);
    const body = screen.getByRole('heading', { name: 'Title' });
    fireEvent.pointerDown(body, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(noteEl(), { pointerId: 1, buttons: 1, clientX: 33, clientY: 9 });
    fireEvent.pointerUp(noteEl(), { pointerId: 1, clientX: 33, clientY: 9 });
    expect(handlers.onBringToFront).toHaveBeenCalledWith(5);
    expect(handlers.onGeometryChange).toHaveBeenCalledWith(5, { x: 140, y: 40, w: 260, h: 200 });
  });

  it('resizing respects the note minimum size', () => {
    render(<Harness />);
    const handle = within(noteEl()).getByTitle('Resize');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: -1000, clientY: -1000 });
    expect(handlers.onGeometryChange).toHaveBeenCalledWith(5, { x: 100, y: 40, w: 160, h: 100 });
  });

  it('delete asks for confirmation when the note has content', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);
    fireEvent.click(within(noteEl()).getByTitle('Delete note'));
    expect(confirm).toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('an empty note is deleted without confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Harness note={{ ...NOTE, content: '  ' }} />);
    fireEvent.click(within(noteEl()).getByTitle('Delete note'));
    expect(confirm).not.toHaveBeenCalled();
    expect(handlers.onDelete).toHaveBeenCalledWith(5);
    confirm.mockRestore();
  });

  it('changing the color reports it', () => {
    render(<Harness />);
    fireEvent.change(within(noteEl()).getByTitle('Note color'), { target: { value: '#3388ff' } });
    expect(handlers.onColorChange).toHaveBeenCalledWith(5, '#3388ff');
  });

  it('double-clicking a checkbox or link does not enter edit mode', () => {
    render(<Harness note={{ ...NOTE, content: '- [ ] task\n\n[site](https://example.com)' }} />);
    const checkbox = screen.getByRole('checkbox');
    const link = screen.getByRole('link');
    const capture = vi.fn();
    noteEl().setPointerCapture = capture;
    for (const el of [checkbox, link]) {
      fireEvent.pointerDown(el, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.doubleClick(el);
    }
    expect(capture).not.toHaveBeenCalled();
    expect(within(noteEl()).queryByRole('textbox')).toBeNull();
  });
});
