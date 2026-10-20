import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateButtons } from './TemplateButtons';
import type { Template } from '../types';

let mockTemplates: Template[] = [];
const mockAddObjective = vi.fn();

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    templates: mockTemplates,
    buckets: [
      { id: 1, name: 'Mission', color: '#fff', sort_order: 0, kind: 'mission', x: 0, y: 0, w: 1, h: 1 },
      { id: 2, name: 'Unsorted', color: '#fff', sort_order: 1, kind: 'unsorted', x: 0, y: 0, w: 1, h: 1 },
      { id: 9, name: 'Work', color: '#fff', sort_order: 2, kind: 'custom', x: 0, y: 0, w: 1, h: 1 },
    ],
    categories: [],
    addObjective: mockAddObjective,
  }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn(), playHover: vi.fn() } }));

const tpl = (id: number, name: string, color: string): Template => ({ id, name, title: '$t', details: '', color, category_id: null, sort_order: id });

describe('TemplateButtons', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAddObjective.mockReset();
    mockTemplates = [tpl(1, 'Bug', '#ff4444'), tpl(2, 'Review', '#3388ff')];
  });

  it('renders nothing when there are no templates', () => {
    mockTemplates = [];
    const { container } = render(<TemplateButtons />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one button per template, in template order, drawn in its color', () => {
    render(<TemplateButtons />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map(b => b.textContent)).toEqual(['Bug', 'Review']);
    expect(buttons[0].style.getPropertyValue('--btn-color')).toBe('#ff4444');
    expect(buttons[1].style.getPropertyValue('--btn-color')).toBe('#3388ff');
  });

  it('clicking a button opens that template\'s dialog', () => {
    render(<TemplateButtons />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByRole('dialog', { name: 'Review' })).toBeInTheDocument();
  });

  it('closing the dialog returns to the buttons', () => {
    render(<TemplateButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('passes the panel\'s bucket and Mission default to the dialog', () => {
    render(<TemplateButtons defaultBucketId={9} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    expect(screen.getByLabelText('BUCKET')).toHaveValue('9');
    expect(screen.getByLabelText('ADD_TO_MISSION')).toBeChecked();
  });

  it('creating from the dialog adds the task', async () => {
    render(<TemplateButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    fireEvent.change(screen.getByLabelText('t'), { target: { value: 'Crash' } });
    fireEvent.click(screen.getByRole('button', { name: 'CREATE_TASK' }));
    expect(mockAddObjective).toHaveBeenCalledWith('Crash', null, false, { bucketId: 2, inMission: true, details: null });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a click on a button does not bubble to the surface that holds it', () => {
    const onParentClick = vi.fn();
    render(<div onClick={onParentClick}><TemplateButtons /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
